"""Pydantic schemas for authentication workflows."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import BaseModel, EmailStr, Field, HttpUrl


class AuthLoginResponse(BaseModel):
    """Response returned when requesting an Auth0 login URL."""

    authorization_url: HttpUrl = Field(..., description="Hosted Auth0 login URL")


class AuthCallbackRequest(BaseModel):
    """Payload sent from the client when exchanging an Auth0 code."""

    code: str = Field(..., description="Authorization code issued by Auth0")
    redirect_uri: HttpUrl = Field(..., description="Redirect URI used during login")


class AuthTokenResponse(BaseModel):
    """Tokens returned from Auth0's token endpoint."""

    access_token: str
    token_type: str
    expires_in: int
    scope: str | None = None
    id_token: str | None = None
    refresh_token: str | None = None


class AuthUserInfoResponse(BaseModel):
    """Subset of Auth0 user profile information."""

    sub: str = Field(..., description="Auth0 user identifier")
    email: EmailStr | None = None
    name: str | None = None
    picture: HttpUrl | None = None
    claims: Dict[str, Any] = Field(
        default_factory=dict,
        description="Raw claims returned by Auth0 beyond standard fields",
    )
