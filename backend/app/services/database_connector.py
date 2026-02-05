from typing import Any, Dict, List, Optional, Tuple
import time
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.engine import Engine
from app.models.connection import Connection
from app.services.encryption import decrypt_password


class DatabaseConnector:
    """Service for connecting to and querying external databases."""
    
    def __init__(self, connection: Connection):
        self.connection = connection
        self.engine: Optional[Engine] = None
    
    def get_connection_url(self) -> str:
        """Build SQLAlchemy connection URL for the database."""
        db_type = self.connection.db_type.lower()
        
        if db_type == "sqlite":
            return f"sqlite:///{self.connection.database_name}"
        
        # Decrypt password
        password = ""
        if self.connection.password_encrypted:
            password = decrypt_password(self.connection.password_encrypted)
        
        username = self.connection.username or ""
        host = self.connection.host or "localhost"
        port = self.connection.port
        database = self.connection.database_name or ""
        
        if db_type == "postgres" or db_type == "postgresql":
            port = port or 5432
            return f"postgresql://{username}:{password}@{host}:{port}/{database}"
        elif db_type == "mysql":
            port = port or 3306
            return f"mysql+pymysql://{username}:{password}@{host}:{port}/{database}"
        elif db_type == "mssql":
            port = port or 1433
            # Encrypt=no disables mandatory encryption (Driver 18 defaults to yes)
            return f"mssql+pyodbc://{username}:{password}@{host}:{port}/{database}?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes&Encrypt=no"
        else:
            raise ValueError(f"Unsupported database type: {db_type}")
    
    def connect(self) -> Engine:
        """Create database engine."""
        if self.engine is None:
            url = self.get_connection_url()
            self.engine = create_engine(url, pool_pre_ping=True)
        return self.engine
    
    def test_connection(self) -> Tuple[bool, str]:
        """Test if connection works."""
        try:
            engine = self.connect()
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True, "Connection successful"
        except Exception as e:
            return False, str(e)
    
    def get_schema(self) -> Dict[str, Any]:
        """Get database schema information."""
        engine = self.connect()
        db_type = self.connection.db_type.lower()
        
        # For MSSQL, use efficient batch query via INFORMATION_SCHEMA
        if db_type == "mssql":
            return self._get_mssql_schema(engine)
        
        # For other databases, use SQLAlchemy inspector
        inspector = inspect(engine)
        tables = []
        
        for table_name in inspector.get_table_names():
            columns = []
            try:
                for col in inspector.get_columns(table_name):
                    columns.append({
                        "name": col["name"],
                        "data_type": str(col["type"]),
                        "is_nullable": col.get("nullable", True),
                        "is_primary_key": False,
                        "foreign_key": None
                    })
            except:
                pass
            
            tables.append({
                "name": table_name,
                "columns": columns,
                "row_count": None
            })
        
        return {"tables": tables}
    
    def _get_mssql_schema(self, engine) -> Dict[str, Any]:
        """Get MSSQL schema using efficient batch query."""
        # Single query to get all columns for all tables in dbo schema
        schema_query = text("""
            SELECT 
                t.TABLE_NAME,
                c.COLUMN_NAME,
                c.DATA_TYPE,
                c.IS_NULLABLE,
                CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PRIMARY_KEY
            FROM INFORMATION_SCHEMA.TABLES t
            JOIN INFORMATION_SCHEMA.COLUMNS c 
                ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
            LEFT JOIN (
                SELECT ku.TABLE_NAME, ku.COLUMN_NAME
                FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                    ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                    AND tc.TABLE_SCHEMA = 'dbo'
            ) pk ON c.TABLE_NAME = pk.TABLE_NAME AND c.COLUMN_NAME = pk.COLUMN_NAME
            WHERE t.TABLE_SCHEMA = 'dbo' AND t.TABLE_TYPE = 'BASE TABLE'
            ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
        """)
        
        tables_dict = {}
        with engine.connect() as conn:
            result = conn.execute(schema_query)
            for row in result:
                table_name = row[0]
                if table_name not in tables_dict:
                    tables_dict[table_name] = {
                        "name": table_name,
                        "columns": [],
                        "row_count": None
                    }
                tables_dict[table_name]["columns"].append({
                    "name": row[1],
                    "data_type": row[2],
                    "is_nullable": row[3] == "YES",
                    "is_primary_key": bool(row[4]),
                    "foreign_key": None
                })
        
        return {"tables": list(tables_dict.values())}
    
    def get_table_preview(self, table_name: str, limit: int = 5) -> Dict[str, Any]:
        """Get preview data from a table."""
        engine = self.connect()
        
        with engine.connect() as conn:
            # Sanitize table name to prevent SQL injection
            inspector = inspect(engine)
            if table_name not in inspector.get_table_names():
                raise ValueError(f"Table '{table_name}' not found")
            
            result = conn.execute(text(f"SELECT * FROM {table_name} LIMIT :limit"), {"limit": limit})
            columns = list(result.keys())
            rows = [list(row) for row in result.fetchall()]
        
        return {
            "columns": columns,
            "rows": rows
        }
    
    def execute_query(self, sql: str, timeout: int = 30) -> Dict[str, Any]:
        """Execute a SQL query and return results."""
        engine = self.connect()
        
        start_time = time.time()
        
        with engine.connect() as conn:
            # Set timeout if supported
            result = conn.execute(text(sql))
            
            columns = list(result.keys()) if result.returns_rows else []
            rows = [list(row) for row in result.fetchall()] if result.returns_rows else []
            row_count = len(rows)
        
        execution_time_ms = int((time.time() - start_time) * 1000)
        
        return {
            "columns": columns,
            "rows": rows,
            "row_count": row_count,
            "execution_time_ms": execution_time_ms
        }
