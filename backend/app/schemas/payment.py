"""Pydantic models for payment related endpoints."""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, HttpUrl, conint


class PaymentCheckoutRequest(BaseModel):
    """Request payload for creating a Stripe Checkout session."""

    success_url: HttpUrl = Field(..., description="URL to redirect after successful payment")
    cancel_url: HttpUrl = Field(..., description="URL to redirect if the user cancels")
    price_id: str | None = Field(
        default=None, description="Optional override for the Stripe price identifier"
    )
    quantity: conint(gt=0) = Field(default=1, description="Number of seats or units")
    customer_email: EmailStr | None = Field(
        default=None, description="Optional customer email for pre-filling Checkout"
    )


class PaymentCheckoutResponse(BaseModel):
    """Response returned after creating a Stripe Checkout session."""

    session_id: str = Field(..., description="Unique identifier for the Checkout session")
    checkout_url: HttpUrl = Field(..., description="URL where the user can complete payment")
