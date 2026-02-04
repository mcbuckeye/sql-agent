from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base


class Connection(Base):
    __tablename__ = "connections"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    db_type = Column(String(50), nullable=False)  # postgres, mysql, sqlite, mssql
    host = Column(String(255))
    port = Column(Integer)
    database_name = Column(String(255))
    username = Column(String(255))
    password_encrypted = Column(Text)
    ssl_enabled = Column(Boolean, default=False)
    is_readonly = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True))
    
    schema_cache = relationship("SchemaCache", back_populates="connection", uselist=False)


class SchemaCache(Base):
    __tablename__ = "schema_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    connection_id = Column(Integer, ForeignKey("connections.id"), unique=True, nullable=False)
    schema_json = Column(JSONB)
    cached_at = Column(DateTime(timezone=True), server_default=func.now())
    
    connection = relationship("Connection", back_populates="schema_cache")
