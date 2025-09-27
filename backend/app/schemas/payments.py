"""Pydantic models for payments workflows."""

from __future__ import annotations

from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, EmailStr, Field


class CheckoutSessionRequest(BaseModel):
    """Request payload for initiating a Stripe Checkout session."""

    price_id: str | None = Field(
        default=None,
        description="Override the default Stripe Price ID configured in settings.",
    )
    quantity: int = Field(default=1, ge=1, description="Quantity of the selected price.")
    success_url: AnyHttpUrl | None = Field(
        default=None,
        description="URL to redirect to when checkout completes successfully.",
    )
    cancel_url: AnyHttpUrl | None = Field(
        default=None,
        description="URL to redirect to when the user cancels checkout.",
    )
    customer_email: EmailStr | None = Field(
        default=None,
        description="Optional email to prefill the Stripe checkout form.",
    )
    mode: Literal["payment", "subscription"] | None = Field(
        default=None, description="Checkout mode to use for the session."
    )


class CheckoutSessionResponse(BaseModel):
    """Response containing the identifier and URL for the hosted checkout."""

    session_id: str = Field(description="Unique identifier of the Stripe Checkout session.")
    checkout_url: AnyHttpUrl = Field(
        description="URL that the client should redirect the customer to."
    )
