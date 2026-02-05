from pydantic import BaseModel, EmailStr
from typing import Optional, Any, List
from datetime import datetime


# Auth schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# Connection schemas
class ConnectionCreate(BaseModel):
    name: str
    db_type: str
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ssl_enabled: bool = False
    is_readonly: bool = True


class ConnectionUpdate(BaseModel):
    name: Optional[str] = None
    db_type: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ssl_enabled: Optional[bool] = None
    is_readonly: Optional[bool] = None


class ConnectionResponse(BaseModel):
    id: int
    name: str
    db_type: str
    host: Optional[str]
    port: Optional[int]
    database_name: Optional[str]
    username: Optional[str]
    ssl_enabled: bool
    is_readonly: bool
    created_at: datetime
    last_used_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ConnectionTest(BaseModel):
    success: bool
    message: str


# Schema schemas
class ColumnInfo(BaseModel):
    name: str
    data_type: str
    is_nullable: bool
    is_primary_key: bool = False
    foreign_key: Optional[str] = None


class TableInfo(BaseModel):
    name: str
    columns: List[ColumnInfo]
    row_count: Optional[int] = None


class SchemaResponse(BaseModel):
    tables: List[TableInfo]
    cached_at: Optional[datetime] = None


# Query schemas
class GenerateQueryRequest(BaseModel):
    connection_id: int
    natural_language: str


class GenerateQueryResponse(BaseModel):
    sql: str
    explanation: str


class ExecuteQueryRequest(BaseModel):
    connection_id: int
    sql: str


class ExecuteQueryResponse(BaseModel):
    columns: List[str]
    rows: List[List[Any]]
    row_count: int
    execution_time_ms: int


class AskQueryRequest(BaseModel):
    connection_id: int
    natural_language: str
    auto_execute: bool = True


class AskQueryResponse(BaseModel):
    sql: str
    explanation: str
    columns: Optional[List[str]] = None
    rows: Optional[List[List[Any]]] = None
    row_count: Optional[int] = None
    execution_time_ms: Optional[int] = None
    error: Optional[str] = None


class QueryHistoryResponse(BaseModel):
    id: int
    connection_id: int
    natural_language_query: Optional[str]
    generated_sql: Optional[str]
    executed_at: datetime
    execution_time_ms: Optional[int]
    row_count: Optional[int]
    status: Optional[str]
    error_message: Optional[str]
    is_favorite: bool
    
    class Config:
        from_attributes = True


# Visualization schemas
class ChartSuggestion(BaseModel):
    chart_type: str
    reason: str
    config: dict


class VisualizationSuggestRequest(BaseModel):
    columns: List[str]
    sample_data: List[List[Any]]


class VisualizationSuggestResponse(BaseModel):
    suggestions: List[ChartSuggestion]


class SaveVisualizationRequest(BaseModel):
    query_history_id: int
    chart_type: str
    chart_config: dict


class SavedVisualizationResponse(BaseModel):
    id: int
    query_history_id: int
    chart_type: str
    chart_config: dict
    created_at: datetime
    
    class Config:
        from_attributes = True


# Query Feedback schemas
class QueryFeedbackCreate(BaseModel):
    connection_id: int
    natural_language: str
    original_sql: str
    corrected_sql: str


class QueryFeedbackResponse(BaseModel):
    id: int
    connection_id: int
    natural_language: str
    original_sql: str
    corrected_sql: str
    created_at: datetime
    
    class Config:
        from_attributes = True
