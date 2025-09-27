"""Authentication-related API routes."""

from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.dependencies import get_auth_client
from app.schemas.auth import (
    AuthLoginRequest,
    AuthLoginResponse,
    AuthTokenExchangeRequest,
    AuthTokenResponse,
    AuthUserInfo,
)
from app.services.auth import Auth0Client, Auth0Error

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthLoginResponse)
async def start_login(
    payload: AuthLoginRequest,
    auth_client: Auth0Client = Depends(get_auth_client),
) -> AuthLoginResponse:
    """Generate an Auth0 authorization URL for the hosted login page."""

    try:
        url = auth_client.build_authorization_url(
            redirect_uri=payload.redirect_uri,
            state=payload.state,
            prompt=payload.prompt,
            screen_hint=payload.screen_hint,
            scope=payload.scope,
        )
    except Auth0Error as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return AuthLoginResponse(authorization_url=url)


@router.post("/callback", response_model=AuthTokenResponse)
async def complete_login(
    payload: AuthTokenExchangeRequest,
    auth_client: Auth0Client = Depends(get_auth_client),
) -> AuthTokenResponse:
    """Exchange an Auth0 authorization code for tokens."""

    try:
        tokens = await auth_client.exchange_code_for_tokens(
            code=payload.code,
            redirect_uri=payload.redirect_uri,
            code_verifier=payload.code_verifier,
        )
    except Auth0Error as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return AuthTokenResponse(
        access_token=tokens.access_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
        refresh_token=tokens.refresh_token,
        id_token=tokens.id_token,
        scope=tokens.scope,
    )


@router.get("/userinfo", response_model=AuthUserInfo)
async def fetch_user_info(
    authorization: str = Header(..., alias="Authorization"),
    auth_client: Auth0Client = Depends(get_auth_client),
) -> AuthUserInfo:
    """Fetch the Auth0 user profile for the provided access token."""

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Bearer access token required")

    try:
        payload = await auth_client.get_user_info(token)
    except Auth0Error as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    return AuthUserInfo.model_validate(payload)
