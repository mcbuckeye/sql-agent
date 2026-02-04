from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.connection import Connection, SchemaCache
from app.schemas import (
    ConnectionCreate, 
    ConnectionUpdate, 
    ConnectionResponse, 
    ConnectionTest,
    SchemaResponse
)
from app.services.auth import get_current_user
from app.services.encryption import encrypt_password
from app.services.database_connector import DatabaseConnector

router = APIRouter(prefix="/api/connections", tags=["connections"])


@router.get("", response_model=List[ConnectionResponse])
def list_connections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all connections for current user."""
    connections = db.query(Connection).filter(
        Connection.user_id == current_user.id
    ).all()
    return connections


@router.post("", response_model=ConnectionResponse)
def create_connection(
    data: ConnectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new database connection."""
    connection = Connection(
        user_id=current_user.id,
        name=data.name,
        db_type=data.db_type,
        host=data.host,
        port=data.port,
        database_name=data.database_name,
        username=data.username,
        password_encrypted=encrypt_password(data.password) if data.password else None,
        ssl_enabled=data.ssl_enabled,
        is_readonly=data.is_readonly
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    return connection


@router.get("/{connection_id}", response_model=ConnectionResponse)
def get_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific connection."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    return connection


@router.put("/{connection_id}", response_model=ConnectionResponse)
def update_connection(
    connection_id: int,
    data: ConnectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a connection."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    update_data = data.model_dump(exclude_unset=True)
    
    # Handle password separately
    if "password" in update_data and update_data["password"]:
        update_data["password_encrypted"] = encrypt_password(update_data.pop("password"))
    elif "password" in update_data:
        del update_data["password"]
    
    for field, value in update_data.items():
        setattr(connection, field, value)
    
    db.commit()
    db.refresh(connection)
    return connection


@router.delete("/{connection_id}")
def delete_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a connection."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Delete related schema cache
    db.query(SchemaCache).filter(SchemaCache.connection_id == connection_id).delete()
    
    db.delete(connection)
    db.commit()
    return {"message": "Connection deleted"}


@router.post("/{connection_id}/test", response_model=ConnectionTest)
def test_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Test a database connection."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    connector = DatabaseConnector(connection)
    success, message = connector.test_connection()
    
    return ConnectionTest(success=success, message=message)


@router.get("/{connection_id}/schema", response_model=SchemaResponse)
def get_schema(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get schema for a connection (cached)."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    # Check cache
    cache = db.query(SchemaCache).filter(
        SchemaCache.connection_id == connection_id
    ).first()
    
    if cache and cache.schema_json:
        return SchemaResponse(
            tables=cache.schema_json.get("tables", []),
            cached_at=cache.cached_at
        )
    
    # Fetch fresh schema
    connector = DatabaseConnector(connection)
    try:
        schema_data = connector.get_schema()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get schema: {str(e)}")
    
    # Update cache
    if cache:
        cache.schema_json = schema_data
        cache.cached_at = datetime.utcnow()
    else:
        cache = SchemaCache(
            connection_id=connection_id,
            schema_json=schema_data
        )
        db.add(cache)
    
    db.commit()
    
    return SchemaResponse(
        tables=schema_data.get("tables", []),
        cached_at=cache.cached_at
    )


@router.post("/{connection_id}/refresh-schema", response_model=SchemaResponse)
def refresh_schema(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Refresh schema cache for a connection."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    connector = DatabaseConnector(connection)
    try:
        schema_data = connector.get_schema()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get schema: {str(e)}")
    
    # Update or create cache
    cache = db.query(SchemaCache).filter(
        SchemaCache.connection_id == connection_id
    ).first()
    
    if cache:
        cache.schema_json = schema_data
        cache.cached_at = datetime.utcnow()
    else:
        cache = SchemaCache(
            connection_id=connection_id,
            schema_json=schema_data
        )
        db.add(cache)
    
    db.commit()
    
    return SchemaResponse(
        tables=schema_data.get("tables", []),
        cached_at=cache.cached_at
    )


@router.get("/{connection_id}/tables/{table_name}/preview")
def preview_table(
    connection_id: int,
    table_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get preview data for a table."""
    connection = db.query(Connection).filter(
        Connection.id == connection_id,
        Connection.user_id == current_user.id
    ).first()
    
    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    connector = DatabaseConnector(connection)
    try:
        preview = connector.get_table_preview(table_name)
        return preview
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
