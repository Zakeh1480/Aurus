"""
Segredo compartilhado apps/api <-> services/ai (Prompt 13). Este serviço não
tem CORS nem é chamado diretamente do browser (CONTRACT.md: "server-to-server
only") — isso por si só não é autenticação, só posicionamento de rede. Este
header é a camada de defesa em profundidade caso o serviço fique alcançável
de onde não deveria.

Falha fechado sempre: sem AI_SERVICE_SHARED_SECRET configurado, nenhuma
requisição passa (não há bypass "se a env var não existir, deixa passar").
"""

import hmac
import os

from fastapi import Header, HTTPException, status


def verify_service_secret(x_ai_service_secret: str | None = Header(default=None)) -> None:
    expected = os.getenv("AI_SERVICE_SHARED_SECRET", "")
    if not expected or not x_ai_service_secret or not hmac.compare_digest(x_ai_service_secret, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing service secret")
