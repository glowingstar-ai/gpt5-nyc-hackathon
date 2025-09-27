from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application configuration managed via environment variables."""

    project_name: str = Field(default="GPT5 Hackathon API", alias="PROJECT_NAME")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_api_base_url: str = Field(
        default="https://api.openai.com/v1", alias="OPENAI_API_BASE_URL"
    )
    openai_realtime_model: str = Field(
        default="gpt-4o-realtime-preview-2024-12-17", alias="OPENAI_REALTIME_MODEL"
    )
    openai_realtime_voice: str = Field(default="verse", alias="OPENAI_REALTIME_VOICE")
    openai_realtime_instructions: str | None = Field(
        default=None, alias="OPENAI_REALTIME_INSTRUCTIONS"
    )

    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()
