"""Auth0 service integration used for login flows."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx


class Auth0ClientError(RuntimeError):
    """Raised when Auth0 returns an unexpected response."""


@dataclass(slots=True)
class AuthTokens:
    """Structured representation of an Auth0 access token response."""

    access_token: str
    token_type: str
    expires_in: int
    scope: Optional[str] = None
    id_token: Optional[str] = None
    refresh_token: Optional[str] = None

    @classmethod
    def from_payload(cls, payload: Dict[str, Any]) -> "AuthTokens":
        """Create an ``AuthTokens`` instance from an Auth0 token payload."""

        try:
            return cls(
                access_token=payload["access_token"],
                token_type=payload["token_type"],
                expires_in=int(payload["expires_in"]),
                scope=payload.get("scope"),
                id_token=payload.get("id_token"),
                refresh_token=payload.get("refresh_token"),
            )
        except KeyError as exc:  # pragma: no cover - defensive branch
            missing = exc.args[0]
            raise Auth0ClientError(f"Token response missing '{missing}' field") from exc


@dataclass(slots=True)
class AuthUserInfo:
    """Representation of the user profile returned by Auth0."""

    sub: str
    email: Optional[str]
    name: Optional[str]
    picture: Optional[str]
    raw: Dict[str, Any]

    @classmethod
    def from_payload(cls, payload: Dict[str, Any]) -> "AuthUserInfo":
        """Instantiate from an Auth0 ``/userinfo`` payload."""

        try:
            subject = payload["sub"]
        except KeyError as exc:  # pragma: no cover - defensive branch
            raise Auth0ClientError("User info response missing 'sub'") from exc

        return cls(
            sub=subject,
            email=payload.get("email"),
            name=payload.get("name"),
            picture=payload.get("picture"),
            raw=payload,
        )


class Auth0Client:
    """Small wrapper around Auth0's OAuth endpoints."""

    def __init__(
        self,
        *,
        domain: str,
        client_id: str,
        client_secret: str | None = None,
        audience: str | None = None,
        default_scope: str = "openid profile email",
        timeout: float = 10.0,
    ) -> None:
        if not domain:
            raise ValueError("Auth0 domain is required")

        normalized_domain = domain.strip().rstrip("/")
        if not normalized_domain.startswith("http://") and not normalized_domain.startswith(
            "https://"
        ):
            normalized_domain = f"https://{normalized_domain}"

        self.base_url = normalized_domain
        self.client_id = client_id
        self.client_secret = client_secret
        self.audience = audience
        self.default_scope = default_scope
        self.timeout = timeout

    def build_authorize_url(
        self,
        *,
        redirect_uri: str,
        state: str | None = None,
        scope: str | None = None,
        audience: str | None = None,
    ) -> str:
        """Return the hosted login page URL for initiating Auth0 login."""

        params: Dict[str, Any] = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": scope or self.default_scope,
        }

        final_audience = audience or self.audience
        if final_audience:
            params["audience"] = final_audience
        if state:
            params["state"] = state

        query = urlencode({k: v for k, v in params.items() if v is not None})
        return f"{self.base_url}/authorize?{query}"

    async def exchange_code_for_tokens(self, *, code: str, redirect_uri: str) -> AuthTokens:
        """Trade an authorization code for Auth0 tokens."""

        token_url = f"{self.base_url}/oauth/token"
        payload: Dict[str, Any] = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "code": code,
            "redirect_uri": redirect_uri,
        }

        if self.client_secret:
            payload["client_secret"] = self.client_secret
        if self.audience:
            payload["audience"] = self.audience

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                token_url,
                data=payload,
                headers={"content-type": "application/x-www-form-urlencoded"},
            )

        if response.status_code >= 400:
            message = response.text or response.reason_phrase
            raise Auth0ClientError(
                f"Auth0 token exchange failed with status {response.status_code}: {message}"
            )

        return AuthTokens.from_payload(response.json())

    async def get_user_info(self, access_token: str) -> AuthUserInfo:
        """Fetch the authenticated user's profile using the provided access token."""

        url = f"{self.base_url}/userinfo"
        headers = {"Authorization": f"Bearer {access_token}"}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(url, headers=headers)

        if response.status_code >= 400:
            message = response.text or response.reason_phrase
            raise Auth0ClientError(
                f"Auth0 user info request failed with status {response.status_code}: {message}"
            )

        return AuthUserInfo.from_payload(response.json())
