from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings

ENV_FILE_PATH = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    database_url: str = "postgres://hamvajeh:hamvajeh@localhost:5432/hamvajeh"
    google_api_key: str
    logfire_token: str | None = None

    class Config:
        env_file = str(ENV_FILE_PATH)
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
