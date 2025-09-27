"""Authentication service integrations."""

from __future__ import annotations

import urllib.parse
from dataclasses import dataclass

import httpx


class Auth0Error(Exception):
    """Base exception for Auth0-related failures."""


class Auth0ConfigurationError(Auth0Error):
    """Raised when the Auth0 client is missing required configuration."""


@dataclass
class Auth0Tokens:
    """Structured representation of tokens returned by Auth0."""

    access_token: str
    token_type: str
    expires_in: int | None = None
    refresh_token: str | None = None
    id_token: str | None = None
    scope: str | None = None


class Auth0Client:
    """Lightweight wrapper around Auth0's OAuth endpoints."""

    def __init__(
        self,
        *,
        domain: str,
        client_id: str,
        client_secret: str,
        audience: str | None = None,
        default_redirect_uri: str | None = None,
        default_scope: str = "openid profile email offline_access",
    ) -> None:
        if not domain or not client_id or not client_secret:
            raise Auth0ConfigurationError(
                "Auth0 domain, client ID, and client secret must be provided"
            )

        self._domain = domain.rstrip("/")
        self._client_id = client_id
        self._client_secret = client_secret
        self._audience = audience
        self._default_redirect_uri = default_redirect_uri
        self._default_scope = default_scope

    @property
    def base_url(self) -> str:
        return f"https://{self._domain}" if not self._domain.startswith("http") else self._domain

    def build_authorization_url(
        self,
        *,
        redirect_uri: str | None = None,
        state: str | None = None,
        prompt: str | None = None,
        screen_hint: str | None = None,
        scope: str | None = None,
    ) -> str:
        """Return the hosted login page URL with the provided parameters."""

        resolved_redirect = redirect_uri or self._default_redirect_uri
        if not resolved_redirect:
            raise Auth0ConfigurationError(
                "A redirect URI must be provided either in the request or settings"
            )

        query: dict[str, str] = {
            "response_type": "code",
            "client_id": self._client_id,
            "redirect_uri": resolved_redirect,
            "scope": scope or self._default_scope,
        }

        if self._audience:
            query["audience"] = self._audience
        if state:
            query["state"] = state
        if prompt:
            query["prompt"] = prompt
        if screen_hint:
            query["screen_hint"] = screen_hint

        encoded = urllib.parse.urlencode(query)
        return f"{self.base_url}/authorize?{encoded}"

    async def exchange_code_for_tokens(
        self,
        *,
        code: str,
        redirect_uri: str | None = None,
        code_verifier: str | None = None,
    ) -> Auth0Tokens:
        """Exchange an authorization code for tokens."""

        if not code:
            raise Auth0Error("Authorization code is required")

        resolved_redirect = redirect_uri or self._default_redirect_uri
        if not resolved_redirect:
            raise Auth0ConfigurationError(
                "A redirect URI must be provided either in the request or settings"
            )

        payload = {
            "grant_type": "authorization_code",
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "code": code,
            "redirect_uri": resolved_redirect,
        }

        if self._audience:
            payload["audience"] = self._audience
        if code_verifier:
            payload["code_verifier"] = code_verifier

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/oauth/token",
                data=payload,
                timeout=httpx.Timeout(10.0),
            )

        if response.status_code >= 400:
            raise Auth0Error(
                f"Auth0 token exchange failed ({response.status_code}): {response.text}"
            )

        data = response.json()
        return Auth0Tokens(
            access_token=data.get("access_token"),
            token_type=data.get("token_type", "Bearer"),
            expires_in=data.get("expires_in"),
            refresh_token=data.get("refresh_token"),
            id_token=data.get("id_token"),
            scope=data.get("scope"),
        )

    async def get_user_info(self, access_token: str) -> dict[str, object]:
        """Fetch the Auth0 user profile associated with the access token."""

        if not access_token:
            raise Auth0Error("Access token is required to fetch user info")

        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/userinfo",
                headers=headers,
                timeout=httpx.Timeout(10.0),
            )

        if response.status_code >= 400:
            raise Auth0Error(
                f"Auth0 userinfo request failed ({response.status_code}): {response.text}"
            )

        return response.json()
