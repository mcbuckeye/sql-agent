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
        inspector = inspect(engine)
        db_type = self.connection.db_type.lower()
        
        tables = []
        
        # For MSSQL, explicitly get tables from dbo schema
        if db_type == "mssql":
            table_names = inspector.get_table_names(schema="dbo")
        else:
            table_names = inspector.get_table_names()
        
        for table_name in table_names:
            columns = []
            pk_columns = set()
            
            # Get primary keys
            try:
                schema_arg = "dbo" if db_type == "mssql" else None
                pk_info = inspector.get_pk_constraint(table_name, schema=schema_arg)
                if pk_info:
                    pk_columns = set(pk_info.get("constrained_columns", []))
            except:
                pass
            
            # Get foreign keys (skip for performance on large DBs)
            fk_map = {}
            
            # Get columns
            try:
                schema_arg = "dbo" if db_type == "mssql" else None
                for col in inspector.get_columns(table_name, schema=schema_arg):
                    columns.append({
                        "name": col["name"],
                        "data_type": str(col["type"]),
                        "is_nullable": col.get("nullable", True),
                        "is_primary_key": col["name"] in pk_columns,
                        "foreign_key": fk_map.get(col["name"])
                    })
            except:
                pass
            
            # Skip row count - too slow on large databases
            tables.append({
                "name": table_name,
                "columns": columns,
                "row_count": None
            })
        
        return {"tables": tables}
    
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
