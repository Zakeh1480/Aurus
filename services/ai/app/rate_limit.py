"""Middleware de rate limiting por IP (Prompt 28).

`services/ai` é server-to-server só (apps/api -> services/ai), protegido pelo
segredo compartilhado (X-AI-Service-Secret) — mas nada aqui limitava volume
de requisições: se o segredo vazar, ou se apps/api tiver um bug de loop, nada
neste serviço freia isso. Janela fixa em memória (sem Redis, ao contrário do
WsRateLimiterService de apps/api) — aceitável como defesa em profundidade
porque o chamador de fato é sempre apps/api, não um público amplo de IPs
diferentes; não é cross-instance-safe se este serviço rodar com múltiplas
réplicas (cada réplica conta separado), mas ainda é um teto real contra
volume anômalo vindo de um único caller.
"""

import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int, window_seconds: int) -> None:
        super().__init__(app)
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._counters: dict[str, tuple[int, int]] = {}

    def _client_key(self, request: Request) -> str:
        client = request.client
        return client.host if client is not None else "unknown"

    def _allow(self, key: str) -> bool:
        now = int(time.time())
        window = now // self._window_seconds
        stored_window, count = self._counters.get(key, (window, 0))

        if stored_window != window:
            stored_window, count = window, 0

        count += 1
        self._counters[key] = (stored_window, count)
        return count <= self._max_requests

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path == "/health":
            return await call_next(request)

        if not self._allow(self._client_key(request)):
            return JSONResponse(status_code=429, content={"detail": "Too many requests"})

        return await call_next(request)
