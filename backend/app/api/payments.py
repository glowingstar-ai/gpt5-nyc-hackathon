"""Payment-related API routes."""

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_payment_processor
from app.schemas.payments import CheckoutSessionRequest, CheckoutSessionResponse
from app.services.payments import StripePaymentError, StripePaymentProcessor

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/checkout", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    payload: CheckoutSessionRequest,
    processor: StripePaymentProcessor = Depends(get_payment_processor),
) -> CheckoutSessionResponse:
    """Create a Stripe Checkout session and return the redirect URL."""

    try:
        session = await processor.create_checkout_session(
            price_id=payload.price_id,
            quantity=payload.quantity,
            success_url=payload.success_url,
            cancel_url=payload.cancel_url,
            customer_email=payload.customer_email,
            mode=payload.mode,
        )
    except StripePaymentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CheckoutSessionResponse(
        session_id=session.session_id,
        checkout_url=session.url,
    )
