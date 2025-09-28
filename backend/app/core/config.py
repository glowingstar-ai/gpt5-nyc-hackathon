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
        default="gpt-realtime", alias="OPENAI_REALTIME_MODEL"
    )
    openai_realtime_voice: str = Field(default="verse", alias="OPENAI_REALTIME_VOICE")
    openai_realtime_instructions: str | None = Field(
        default=None, alias="OPENAI_REALTIME_INSTRUCTIONS"
    )
    openai_annotation_model: str = Field(
        default="gpt-5.0", alias="OPENAI_ANNOTATION_MODEL"
    )
    openai_research_model: str = Field(
        default="gpt-5.0", alias="OPENAI_RESEARCH_MODEL"
    )
    openai_generative_ui_model: str = Field(
        default="gpt-5.0", alias="OPENAI_GENERATIVE_UI_MODEL"
    )
    aws_access_key_id: str | None = Field(default=None, alias="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: str | None = Field(
        default=None, alias="AWS_SECRET_ACCESS_KEY"
    )
    aws_region_name: str | None = Field(default=None, alias="AWS_REGION")
    aws_s3_bucket: str | None = Field(default=None, alias="AWS_S3_BUCKET")
    auth0_domain: str | None = Field(default=None, alias="AUTH0_DOMAIN")
    auth0_client_id: str | None = Field(default=None, alias="AUTH0_CLIENT_ID")
    auth0_client_secret: str | None = Field(
        default=None, alias="AUTH0_CLIENT_SECRET"
    )
    auth0_audience: str | None = Field(default=None, alias="AUTH0_AUDIENCE")
    stripe_secret_key: str | None = Field(default=None, alias="STRIPE_SECRET_KEY")
    stripe_default_price_id: str | None = Field(
        default=None, alias="STRIPE_DEFAULT_PRICE_ID"
    )
    stripe_mode: str = Field(default="subscription", alias="STRIPE_MODE")
    cohere_api_key: str | None = Field(default=None, alias="COHERE_API_KEY")
    cohere_api_base_url: str = Field(
        default="https://api.cohere.com", alias="COHERE_API_BASE_URL"
    )
    cohere_rerank_model: str = Field(
        default="rerank-english-v3.0", alias="COHERE_RERANK_MODEL"
    )
    arxiv_api_base_url: str = Field(
        default="http://export.arxiv.org/api/query", alias="ARXIV_API_BASE_URL"
    )
    arxiv_max_results: int = Field(default=25, alias="ARXIV_MAX_RESULTS")

    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""

    return Settings()
