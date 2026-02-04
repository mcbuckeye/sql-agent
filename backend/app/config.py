from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql://sqlagent:sqlagent_secret@sqlagent-postgres:5432/sqlagent"
    secret_key: str = "sqlagent-secret-key-change-in-prod"
    openai_api_key: str = ""
    encryption_key: str = "sqlagent-encryption-key-32bytes!"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
