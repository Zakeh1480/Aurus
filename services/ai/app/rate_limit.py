import time

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_requests: int, window_seconds: int) -> None:
        super().__init__(app)
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._windows: dict[int, dict[str, int]] = {}

    def _client_key(self, request: Request) -> str:
        client = request.client
        return client.host if client is not None else "unknown"

    def _allow(self, key: str) -> bool:
        now = int(time.time())
        window = now // self._window_seconds

        for stale_window in [w for w in self._windows if w < window]:
            del self._windows[stale_window]

        bucket = self._windows.setdefault(window, {})
        count = bucket.get(key, 0) + 1
        bucket[key] = count
        return count <= self._max_requests

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path == "/health":
            return await call_next(request)

        if not self._allow(self._client_key(request)):
            return JSONResponse(status_code=429, content={"detail": "Too many requests"})

        return await call_next(request)
