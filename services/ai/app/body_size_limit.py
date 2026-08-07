"""Middleware de limite de tamanho de corpo de requisição (Prompt 16).

Nada no FastAPI/Starlette limita o tamanho de um corpo de requisição por
padrão — o corpo inteiro é bufferizado em memória antes de qualquer
validação Pydantic rodar. Checagem via header `Content-Length`: tráfego aqui
é sempre server-to-server (apps/api -> services/ai), e todo cliente HTTP
padrão declara esse header — não cobre um corpo chunked sem `Content-Length`
declarado, mas isso não é como este serviço é chamado hoje.
"""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_bytes: int) -> None:
        super().__init__(app)
        self._max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                declared_bytes = int(content_length)
            except ValueError:
                declared_bytes = None
            if declared_bytes is not None and declared_bytes > self._max_bytes:
                return JSONResponse(status_code=413, content={"detail": "Request body too large"})
        return await call_next(request)
