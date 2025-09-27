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
    openai_annotation_model: str = Field(
        default="gpt-5.0", alias="OPENAI_ANNOTATION_MODEL"
    )
    openai_research_model: str = Field(default="gpt-5.0", alias="OPENAI_RESEARCH_MODEL")
    cohere_api_key: str | None = Field(default=None, alias="COHERE_API_KEY")
    cohere_rerank_model: str = Field(
        default="rerank-english-v3.0", alias="COHERE_RERANK_MODEL"
    )
    arxiv_index_path: str = Field(
        default="app/data/arxiv_index.json", alias="ARXIV_INDEX_PATH"
    )
    aws_access_key_id: str | None = Field(default=None, alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(
        default=None, alias="AWS_SECRET_ACCESS_KEY"
    )
    aws_region_name: str | None = Field(default=None, alias="AWS_REGION")
    aws_s3_bucket: str | None = Field(default=None, alias="AWS_S3_BUCKET")

    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()
