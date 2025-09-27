import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.anyio
async def test_health_endpoint_returns_ok() -> None:
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/api/v1/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["service"] == "GPT5 Hackathon API"
