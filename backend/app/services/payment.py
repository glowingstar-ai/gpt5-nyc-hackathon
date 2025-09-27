"""Stripe payment helpers for creating Checkout sessions."""

from __future__ import annotations

from dataclasses import dataclass

import stripe


class StripePaymentError(RuntimeError):
    """Raised when the Stripe API returns an unexpected response."""


@dataclass(slots=True)
class CheckoutSession:
    """Lightweight representation of a Stripe Checkout session."""

    session_id: str
    url: str


class StripePaymentService:
    """Wrapper around the Stripe SDK for creating Checkout sessions."""

    def __init__(
        self,
        *,
        api_key: str,
        default_price_id: str | None = None,
        mode: str = "subscription",
    ) -> None:
        if not api_key:
            raise ValueError("Stripe secret key is required")

        self.api_key = api_key
        self.default_price_id = default_price_id
        self.mode = mode

    def create_checkout_session(
        self,
        *,
        success_url: str,
        cancel_url: str,
        price_id: str | None = None,
        quantity: int = 1,
        customer_email: str | None = None,
    ) -> CheckoutSession:
        """Create and return a hosted Stripe Checkout session."""

        final_price_id = price_id or self.default_price_id
        if not final_price_id:
            raise StripePaymentError("Stripe price identifier is not configured")

        if quantity <= 0:
            raise StripePaymentError("Quantity must be greater than zero")

        stripe.api_key = self.api_key

        params: dict[str, object] = {
            "mode": self.mode,
            "success_url": success_url,
            "cancel_url": cancel_url,
            "line_items": [{"price": final_price_id, "quantity": quantity}],
            "automatic_tax": {"enabled": True},
        }
        if customer_email:
            params["customer_email"] = customer_email

        try:
            session = stripe.checkout.Session.create(**params)
        except stripe.error.StripeError as exc:  # pragma: no cover - requires live Stripe
            raise StripePaymentError(str(exc)) from exc

        session_id = getattr(session, "id", None)
        session_url = getattr(session, "url", None)
        if not session_id or not session_url:
            raise StripePaymentError("Stripe session response missing identifiers")

        return CheckoutSession(session_id=session_id, url=session_url)
