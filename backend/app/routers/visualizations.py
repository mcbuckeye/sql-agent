from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.query import SavedVisualization
from app.schemas import (
    VisualizationSuggestRequest,
    VisualizationSuggestResponse,
    SaveVisualizationRequest,
    SavedVisualizationResponse,
    ChartSuggestion
)
from app.services.auth import get_current_user
from app.services.sql_generator import SQLGenerator

router = APIRouter(prefix="/api/visualize", tags=["visualizations"])


@router.post("/suggest", response_model=VisualizationSuggestResponse)
def suggest_visualizations(
    request: VisualizationSuggestRequest,
    current_user: User = Depends(get_current_user)
):
    """Suggest appropriate chart types for data."""
    generator = SQLGenerator()
    suggestions = generator.suggest_visualizations(
        request.columns,
        request.sample_data
    )
    
    return VisualizationSuggestResponse(
        suggestions=[
            ChartSuggestion(**s) for s in suggestions
        ]
    )


@router.post("", response_model=SavedVisualizationResponse)
def save_visualization(
    request: SaveVisualizationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Save a visualization."""
    viz = SavedVisualization(
        user_id=current_user.id,
        query_history_id=request.query_history_id,
        chart_type=request.chart_type,
        chart_config=request.chart_config
    )
    db.add(viz)
    db.commit()
    db.refresh(viz)
    return viz


@router.get("", response_model=List[SavedVisualizationResponse])
def list_visualizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List saved visualizations."""
    visualizations = db.query(SavedVisualization).filter(
        SavedVisualization.user_id == current_user.id
    ).order_by(SavedVisualization.created_at.desc()).all()
    return visualizations


@router.delete("/{viz_id}")
def delete_visualization(
    viz_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a saved visualization."""
    viz = db.query(SavedVisualization).filter(
        SavedVisualization.id == viz_id,
        SavedVisualization.user_id == current_user.id
    ).first()
    
    if not viz:
        raise HTTPException(status_code=404, detail="Visualization not found")
    
    db.delete(viz)
    db.commit()
    return {"message": "Visualization deleted"}
