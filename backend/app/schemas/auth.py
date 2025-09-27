"""Pydantic models for authentication workflows."""

from __future__ import annotations

from typing import Any

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field


class AuthLoginRequest(BaseModel):
    """Payload used to construct an Auth0 authorization URL."""

    redirect_uri: AnyHttpUrl | None = Field(
        default=None,
        description="Override the default redirect URI configured for Auth0.",
    )
    state: str | None = Field(
        default=None,
        description="Opaque value to maintain state between requests.",
    )
    prompt: str | None = Field(
        default=None,
        description="Pass-through prompt parameter for Auth0 (e.g. 'login').",
    )
    screen_hint: str | None = Field(
        default=None,
        description="Screen hint to direct Auth0 to a specific UI (e.g. 'signup').",
    )
    scope: str | None = Field(
        default=None,
        description="Custom OAuth scope to request in addition to the defaults.",
    )


class AuthLoginResponse(BaseModel):
    """Response containing the fully-qualified authorization URL."""

    authorization_url: AnyHttpUrl


class AuthTokenExchangeRequest(BaseModel):
    """Payload representing the callback from Auth0 after login."""

    code: str = Field(..., description="Authorization code returned by Auth0.")
    redirect_uri: AnyHttpUrl | None = Field(
        default=None,
        description="Redirect URI used during the authorization request.",
    )
    code_verifier: str | None = Field(
        default=None,
        description="PKCE code verifier when using the Authorization Code Flow with PKCE.",
    )


class AuthTokenResponse(BaseModel):
    """Subset of Auth0 token response fields returned to the caller."""

    access_token: str
    token_type: str
    expires_in: int | None = None
    refresh_token: str | None = None
    id_token: str | None = None
    scope: str | None = None


class AuthUserInfo(BaseModel):
    """User profile returned by Auth0's /userinfo endpoint."""

    model_config = ConfigDict(extra="allow")

    sub: str
    email: str | None = None
    name: str | None = None
    picture: AnyHttpUrl | None = None
    given_name: str | None = None
    family_name: str | None = None
    nickname: str | None = None
    locale: str | None = None
    updated_at: str | None = None
    custom_claims: dict[str, Any] | None = Field(default=None, exclude=True)
