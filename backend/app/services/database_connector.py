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
            return f"mssql+pyodbc://{username}:{password}@{host}:{port}/{database}?driver=ODBC+Driver+17+for+SQL+Server"
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
        
        tables = []
        for table_name in inspector.get_table_names():
            columns = []
            pk_columns = set()
            
            # Get primary keys
            pk_info = inspector.get_pk_constraint(table_name)
            if pk_info:
                pk_columns = set(pk_info.get("constrained_columns", []))
            
            # Get foreign keys
            fk_map = {}
            for fk in inspector.get_foreign_keys(table_name):
                for col in fk.get("constrained_columns", []):
                    referred = f"{fk.get('referred_table')}.{fk.get('referred_columns', [''])[0]}"
                    fk_map[col] = referred
            
            # Get columns
            for col in inspector.get_columns(table_name):
                columns.append({
                    "name": col["name"],
                    "data_type": str(col["type"]),
                    "is_nullable": col.get("nullable", True),
                    "is_primary_key": col["name"] in pk_columns,
                    "foreign_key": fk_map.get(col["name"])
                })
            
            # Get approximate row count (fast method)
            try:
                with engine.connect() as conn:
                    result = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                    row_count = result.scalar()
            except:
                row_count = None
            
            tables.append({
                "name": table_name,
                "columns": columns,
                "row_count": row_count
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
