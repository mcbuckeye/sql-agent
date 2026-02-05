from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database import Base


class QueryHistory(Base):
    __tablename__ = "query_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    connection_id = Column(Integer, ForeignKey("connections.id"), nullable=False)
    natural_language_query = Column(Text)
    generated_sql = Column(Text)
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    execution_time_ms = Column(Integer)
    row_count = Column(Integer)
    status = Column(String(50))  # success, error, timeout
    error_message = Column(Text)
    is_favorite = Column(Boolean, default=False)


class SavedVisualization(Base):
    __tablename__ = "saved_visualizations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    query_history_id = Column(Integer, ForeignKey("query_history.id"), nullable=False)
    chart_type = Column(String(50))
    chart_config = Column(JSONB)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class QueryFeedback(Base):
    """Store user SQL corrections for learning/improvement."""
    __tablename__ = "query_feedback"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    connection_id = Column(Integer, ForeignKey("connections.id"), nullable=False)
    natural_language = Column(Text)
    original_sql = Column(Text)
    corrected_sql = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
