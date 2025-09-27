from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["root"])
async def root() -> dict[str, str]:
    """Root route useful for uptime checks."""

    return {"message": "Welcome to the GPT5 Hackathon API"}
