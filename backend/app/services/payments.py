"""Payment processing integrations."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass

import stripe


class StripePaymentError(Exception):
    """Raised when Stripe operations fail."""


class StripeConfigurationError(StripePaymentError):
    """Raised when the Stripe client is missing required configuration."""


@dataclass(slots=True)
class CheckoutSession:
    """Serializable representation of a Stripe Checkout session."""

    session_id: str
    url: str


class StripePaymentProcessor:
    """Wrapper around the Stripe SDK for creating checkout sessions."""

    def __init__(
        self,
        *,
        api_key: str,
        default_price_id: str | None = None,
        default_success_url: str | None = None,
        default_cancel_url: str | None = None,
        default_mode: str = "subscription",
    ) -> None:
        if not api_key:
            raise StripeConfigurationError("Stripe API key must be provided")

        self._api_key = api_key
        self._default_price_id = default_price_id
        self._default_success_url = default_success_url
        self._default_cancel_url = default_cancel_url
        self._default_mode = default_mode

    async def create_checkout_session(
        self,
        *,
        price_id: str | None = None,
        quantity: int = 1,
        success_url: str | None = None,
        cancel_url: str | None = None,
        customer_email: str | None = None,
        mode: str | None = None,
    ) -> CheckoutSession:
        """Create a Stripe Checkout session and return its identifiers."""

        resolved_price_id = price_id or self._default_price_id
        if not resolved_price_id:
            raise StripeConfigurationError(
                "A price ID must be provided either in the request or settings"
            )

        resolved_success = success_url or self._default_success_url
        resolved_cancel = cancel_url or self._default_cancel_url
        if not resolved_success or not resolved_cancel:
            raise StripeConfigurationError(
                "Success and cancel URLs must be provided either in the request or settings"
            )

        stripe.api_key = self._api_key

        def _create_session() -> stripe.checkout.Session:
            return stripe.checkout.Session.create(
                mode=mode or self._default_mode,
                line_items=[
                    {
                        "price": resolved_price_id,
                        "quantity": quantity,
                    }
                ],
                success_url=resolved_success,
                cancel_url=resolved_cancel,
                customer_email=customer_email,
            )

        try:
            session: stripe.checkout.Session = await asyncio.to_thread(_create_session)
        except stripe.error.StripeError as exc:  # type: ignore[attr-defined]
            raise StripePaymentError(str(exc)) from exc

        if not session.url:
            raise StripePaymentError("Stripe did not return a checkout URL")

        return CheckoutSession(session_id=session.id, url=session.url)
