from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.connection import Connection, SchemaCache
from app.models.query import QueryHistory, QueryFeedback
from app.schemas import (
    GenerateQueryRequest,
    GenerateQueryResponse,
    ExecuteQueryRequest,
    ExecuteQueryResponse,
    AskQueryRequest,
    AskQueryResponse,
    QueryHistoryResponse,
    QueryFeedbackCreate,
    QueryFeedbackResponse,
    DetectParametersRequest,
    DetectParametersResponse,
    QueryParameter
)
from app.services.auth import get_current_user
from app.services.database_connector import DatabaseConnector
from app.services.sql_generator import SQLGenerator

router = APIRouter(prefix="/api/query", tags=["query"])


@router.post("/generate", response_model=GenerateQueryResponse)
def generate_query(
    request: GenerateQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate SQL from natural language."""
    connection = db.query(Connection).filter(
        Connection.id == request.connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Get schema
    cache = db.query(SchemaCache).filter(
        SchemaCache.connection_id == request.connection_id
    ).first()
    
    if not cache or not cache.schema_json:
        # Fetch schema on demand
        connector = DatabaseConnector(connection)
        schema_data = connector.get_schema()
    else:
        schema_data = cache.schema_json
    
    # Generate SQL
    generator = SQLGenerator()
    result = generator.generate_sql(
        request.natural_language,
        schema_data,
        connection.db_type
    )
    
    return GenerateQueryResponse(
        sql=result["sql"],
        explanation=result["explanation"]
    )


@router.post("/detect-parameters", response_model=DetectParametersResponse)
def detect_parameters(
    request: DetectParametersRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Detect if a query requires user-specified parameters."""
    connection = db.query(Connection).filter(
        Connection.id == request.connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Get schema
    cache = db.query(SchemaCache).filter(
        SchemaCache.connection_id == request.connection_id
    ).first()
    
    if not cache or not cache.schema_json:
        connector = DatabaseConnector(connection)
        schema_data = connector.get_schema()
    else:
        schema_data = cache.schema_json
    
    # Detect parameters
    generator = SQLGenerator()
    result = generator.detect_parameters(request.natural_language, schema_data)
    
    return DetectParametersResponse(
        needs_parameters=result.get("needs_parameters", False),
        parameters=[QueryParameter(**p) for p in result.get("parameters", [])],
        clarification=result.get("clarification")
    )


@router.post("/execute", response_model=ExecuteQueryResponse)
def execute_query(
    request: ExecuteQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute a SQL query."""
    connection = db.query(Connection).filter(
        Connection.id == request.connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Safety check for read-only mode
    if connection.is_readonly:
        sql_upper = request.sql.strip().upper()
        if not sql_upper.startswith("SELECT") and not sql_upper.startswith("WITH"):
            raise HTTPException(
                status_code=400,
                detail="Connection is read-only. Only SELECT queries allowed."
            )
    
    connector = DatabaseConnector(connection)
    try:
        result = connector.execute_query(request.sql)
        
        # Log to history
        history = QueryHistory(
            user_id=current_user.id,
            connection_id=connection.id,
            generated_sql=request.sql,
            execution_time_ms=result["execution_time_ms"],
            row_count=result["row_count"],
            status="success"
        )
        db.add(history)
        db.commit()
        
        return ExecuteQueryResponse(**result)
    except Exception as e:
        # Log error to history
        history = QueryHistory(
            user_id=current_user.id,
            connection_id=connection.id,
            generated_sql=request.sql,
            status="error",
            error_message=str(e)
        )
        db.add(history)
        db.commit()
        
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ask", response_model=AskQueryResponse)
def ask_query(
    request: AskQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Combined generate + execute flow."""
    connection = db.query(Connection).filter(
        Connection.id == request.connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Get schema
    cache = db.query(SchemaCache).filter(
        SchemaCache.connection_id == request.connection_id
    ).first()
    
    if not cache or not cache.schema_json:
        connector = DatabaseConnector(connection)
        schema_data = connector.get_schema()
    else:
        schema_data = cache.schema_json
    
    # Generate SQL with any provided parameters
    generator = SQLGenerator()
    gen_result = generator.generate_sql(
        request.natural_language,
        schema_data,
        connection.db_type,
        parameters=request.parameters
    )
    
    response = AskQueryResponse(
        sql=gen_result["sql"],
        explanation=gen_result["explanation"]
    )
    
    # Execute if requested
    if request.auto_execute:
        connector = DatabaseConnector(connection)
        try:
            exec_result = connector.execute_query(gen_result["sql"])
            response.columns = exec_result["columns"]
            response.rows = exec_result["rows"]
            response.row_count = exec_result["row_count"]
            response.execution_time_ms = exec_result["execution_time_ms"]
            
            # Log to history
            history = QueryHistory(
                user_id=current_user.id,
                connection_id=connection.id,
                natural_language_query=request.natural_language,
                generated_sql=gen_result["sql"],
                execution_time_ms=exec_result["execution_time_ms"],
                row_count=exec_result["row_count"],
                status="success"
            )
            db.add(history)
            db.commit()
        except Exception as e:
            response.error = str(e)
            
            # Log error
            history = QueryHistory(
                user_id=current_user.id,
                connection_id=connection.id,
                natural_language_query=request.natural_language,
                generated_sql=gen_result["sql"],
                status="error",
                error_message=str(e)
            )
            db.add(history)
            db.commit()
    
    return response


@router.get("/history", response_model=List[QueryHistoryResponse])
def get_history(
    connection_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get query history."""
    query = db.query(QueryHistory).filter(
        QueryHistory.user_id == current_user.id
    )
    
    if connection_id:
        query = query.filter(QueryHistory.connection_id == connection_id)
    
    history = query.order_by(QueryHistory.executed_at.desc()).limit(limit).all()
    return history


@router.put("/history/{history_id}/favorite")
def toggle_favorite(
    history_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle favorite status for a query."""
    history = db.query(QueryHistory).filter(
        QueryHistory.id == history_id,
        QueryHistory.user_id == current_user.id
    ).first()
    
    if not history:
        raise HTTPException(status_code=404, detail="Query not found")
    
    history.is_favorite = not history.is_favorite
    db.commit()
    
    return {"is_favorite": history.is_favorite}


@router.get("/suggestions")
def get_suggestions(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get query suggestions based on schema."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    cache = db.query(SchemaCache).filter(
        SchemaCache.connection_id == connection_id
    ).first()
    
    if not cache or not cache.schema_json:
        raise HTTPException(status_code=400, detail="Schema not cached. Please refresh schema first.")
    
    generator = SQLGenerator()
    suggestions = generator.suggest_queries(cache.schema_json)
    
    return {"suggestions": suggestions}


@router.post("/feedback", response_model=QueryFeedbackResponse)
def submit_feedback(
    request: QueryFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Store user's SQL correction for learning."""
    # Verify connection belongs to user
    connection = db.query(Connection).filter(
        Connection.id == request.connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    feedback = QueryFeedback(
        user_id=current_user.id,
        connection_id=request.connection_id,
        natural_language=request.natural_language,
        original_sql=request.original_sql,
        corrected_sql=request.corrected_sql
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/feedback", response_model=List[QueryFeedbackResponse])
def get_feedback(
    connection_id: Optional[int] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get stored feedback for few-shot learning."""
    query = db.query(QueryFeedback).filter(
        QueryFeedback.user_id == current_user.id
    )
    if connection_id:
        query = query.filter(QueryFeedback.connection_id == connection_id)
    
    return query.order_by(QueryFeedback.created_at.desc()).limit(limit).all()
