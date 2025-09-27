"""Tests covering the authentication endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_auth_client
from app.main import app
from app.services.auth import Auth0Client, AuthTokens, AuthUserInfo


class StubAuth0Client(Auth0Client):
    """In-memory Auth0 stub that records method invocations."""

    def __init__(self) -> None:  # type: ignore[no-untyped-def]
        # Bypass parent initialisation since we're only stubbing behaviour.
        pass

    def build_authorize_url(  # type: ignore[override]
        self,
        *,
        redirect_uri: str,
        state: str | None = None,
        scope: str | None = None,
        audience: str | None = None,
    ) -> str:
        self.last_authorize_args = {
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": scope,
            "audience": audience,
        }
        return "https://auth0.example.com/authorize?client_id=abc"

    async def exchange_code_for_tokens(  # type: ignore[override]
        self,
        *,
        code: str,
        redirect_uri: str,
    ) -> AuthTokens:
        self.last_exchange_args = {"code": code, "redirect_uri": redirect_uri}
        return AuthTokens(
            access_token="access-token",
            token_type="Bearer",
            expires_in=3600,
            scope="openid profile",
            id_token="id-token",
            refresh_token="refresh-token",
        )

    async def get_user_info(self, access_token: str) -> AuthUserInfo:  # type: ignore[override]
        self.last_user_info_token = access_token
        return AuthUserInfo(
            sub="auth0|123",
            email="user@example.com",
            name="Jane Doe",
            picture="https://example.com/avatar.png",
            raw={
                "sub": "auth0|123",
                "email": "user@example.com",
                "name": "Jane Doe",
                "picture": "https://example.com/avatar.png",
                "locale": "en-US",
            },
        )


@pytest.fixture()
def stub_client() -> StubAuth0Client:
    client = StubAuth0Client()
    app.dependency_overrides[get_auth_client] = lambda: client
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_auth_client, None)


@pytest.fixture()
def client(stub_client: StubAuth0Client) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_auth_login_returns_authorize_url(client: TestClient, stub_client: StubAuth0Client) -> None:
    response = client.get(
        "/api/v1/auth/login",
        params={"redirect_uri": "https://example.com/callback", "state": "xyz"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["authorization_url"] == "https://auth0.example.com/authorize?client_id=abc"
    assert stub_client.last_authorize_args == {
        "redirect_uri": "https://example.com/callback",
        "state": "xyz",
        "scope": None,
        "audience": None,
    }


def test_auth_callback_exchanges_code_for_tokens(
    client: TestClient, stub_client: StubAuth0Client
) -> None:
    response = client.post(
        "/api/v1/auth/callback",
        json={"code": "auth-code", "redirect_uri": "https://example.com/callback"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"] == "access-token"
    assert body["token_type"] == "Bearer"
    assert body["refresh_token"] == "refresh-token"
    assert stub_client.last_exchange_args == {
        "code": "auth-code",
        "redirect_uri": "https://example.com/callback",
    }


def test_auth_user_info_requires_bearer_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/user")

    assert response.status_code == 422  # Missing header triggers validation error


def test_auth_user_info_returns_profile(
    client: TestClient, stub_client: StubAuth0Client
) -> None:
    response = client.get(
        "/api/v1/auth/user",
        headers={"Authorization": "Bearer access-token"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["sub"] == "auth0|123"
    assert body["email"] == "user@example.com"
    assert body["claims"]["locale"] == "en-US"
    assert stub_client.last_user_info_token == "access-token"
