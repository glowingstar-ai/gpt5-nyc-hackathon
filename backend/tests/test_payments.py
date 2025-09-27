"""Tests for the Stripe payment integration endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_payment_service
from app.main import app
from app.services.payment import CheckoutSession, StripePaymentError, StripePaymentService


class StubStripePaymentService(StripePaymentService):
    """Stub payment service for testing without hitting Stripe."""

    def __init__(self) -> None:  # type: ignore[no-untyped-def]
        pass

    def create_checkout_session(  # type: ignore[override]
        self,
        *,
        success_url: str,
        cancel_url: str,
        price_id: str | None = None,
        quantity: int = 1,
        customer_email: str | None = None,
    ) -> CheckoutSession:
        self.last_call = {
            "success_url": success_url,
            "cancel_url": cancel_url,
            "price_id": price_id,
            "quantity": quantity,
            "customer_email": customer_email,
        }
        if price_id == "error":
            raise StripePaymentError("invalid price")
        return CheckoutSession(session_id="cs_test_123", url="https://stripe.test/checkout")


@pytest.fixture()
def payment_stub() -> StubStripePaymentService:
    stub = StubStripePaymentService()
    app.dependency_overrides[get_payment_service] = lambda: stub
    try:
        yield stub
    finally:
        app.dependency_overrides.pop(get_payment_service, None)


@pytest.fixture()
def client(payment_stub: StubStripePaymentService) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_create_checkout_session_returns_session(
    client: TestClient, payment_stub: StubStripePaymentService
) -> None:
    payload = {
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel",
        "price_id": "price_123",
        "quantity": 2,
        "customer_email": "customer@example.com",
    }
    response = client.post("/api/v1/payments/checkout", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["session_id"] == "cs_test_123"
    assert body["checkout_url"] == "https://stripe.test/checkout"
    assert payment_stub.last_call == {
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel",
        "price_id": "price_123",
        "quantity": 2,
        "customer_email": "customer@example.com",
    }


def test_create_checkout_session_handles_errors(
    client: TestClient, payment_stub: StubStripePaymentService
) -> None:
    payload = {
        "success_url": "https://example.com/success",
        "cancel_url": "https://example.com/cancel",
        "price_id": "error",
    }
    response = client.post("/api/v1/payments/checkout", json=payload)

    assert response.status_code == 502
    assert response.json()["detail"] == "invalid price"
