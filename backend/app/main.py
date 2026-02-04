from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import engine, Base, SessionLocal
from app.models import User
from app.services.auth import get_password_hash
from app.routers import auth, connections, query, visualizations

# Import all models to register them
from app.models.user import User
from app.models.connection import Connection, SchemaCache
from app.models.query import QueryHistory, SavedVisualization


def init_db():
    """Initialize database and create default user."""
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Check if default user exists
        user = db.query(User).filter(User.email == "steve@ipwatcher.com").first()
        if not user:
            user = User(
                email="steve@ipwatcher.com",
                password_hash=get_password_hash("5678*stud")
            )
            db.add(user)
            db.commit()
            print("Created default user: steve@ipwatcher.com")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown


app = FastAPI(
    title="SQL Agent API",
    description="AI-powered NLP to SQL conversion",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(connections.router)
app.include_router(query.router)
app.include_router(visualizations.router)


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "sql-agent"}


@app.get("/")
def root():
    """Root endpoint."""
    return {"message": "SQL Agent API", "docs": "/docs"}
