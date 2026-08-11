"""Testes isolados de RateLimitMiddleware — app Starlette mínimo, sem
depender da app real (que usa o default de 1200 req/60s, alto demais para
testar o comportamento de forma rápida e determinística)."""

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.rate_limit import RateLimitMiddleware


async def _ok(request: Request) -> PlainTextResponse:
    return PlainTextResponse("ok")


def _build_client(max_requests: int, window_seconds: int) -> TestClient:
    app = Starlette(routes=[Route("/score", _ok, methods=["POST"]), Route("/health", _ok, methods=["GET"])])
    app.add_middleware(RateLimitMiddleware, max_requests=max_requests, window_seconds=window_seconds)
    return TestClient(app)


def test_allows_requests_within_the_limit() -> None:
    client = _build_client(max_requests=3, window_seconds=60)
    for _ in range(3):
        assert client.post("/score").status_code == 200


def test_rejects_requests_above_the_limit_with_429() -> None:
    client = _build_client(max_requests=3, window_seconds=60)
    for _ in range(3):
        client.post("/score")
    response = client.post("/score")
    assert response.status_code == 429


def test_health_is_never_rate_limited() -> None:
    client = _build_client(max_requests=1, window_seconds=60)
    client.post("/score")
    for _ in range(5):
        assert client.get("/health").status_code == 200


def test_different_keys_have_independent_counters() -> None:
    middleware = RateLimitMiddleware(app=_ok, max_requests=1, window_seconds=60)
    assert middleware._allow("1.2.3.4") is True
    assert middleware._allow("1.2.3.4") is False
    assert middleware._allow("5.6.7.8") is True
