from app.core.config import Settings, get_settings as _get_settings


def get_settings() -> Settings:
    """Dependency wrapper for injecting cached settings into routes."""

    return _get_settings()
