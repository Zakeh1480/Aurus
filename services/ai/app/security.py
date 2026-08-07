"""
Segredo compartilhado apps/api <-> services/ai (Prompt 13). Este serviço não
tem CORS nem é chamado diretamente do browser (CONTRACT.md: "server-to-server
only") — isso por si só não é autenticação, só posicionamento de rede. Este
header é a camada de defesa em profundidade caso o serviço fique alcançável
de onde não deveria.

Falha fechado sempre: sem AI_SERVICE_SHARED_SECRET configurado, nenhuma
requisição passa (não há bypass "se a env var não existir, deixa passar").

Rotação com chave anterior (Prompt 18): AI_SERVICE_SHARED_SECRET_PREVIOUS é
opcional e só importa durante a troca do segredo — permite fazer o deploy de
services/ai com o novo valor antes de apps/api (que só envia um valor, nunca
"anterior") sem quebrar scoring/verify no meio do rollout. apps/api não
precisa de um equivalente porque só emite o header, nunca o verifica.
"""

import hmac
import os

from fastapi import Header, HTTPException, status


def verify_service_secret(x_ai_service_secret: str | None = Header(default=None)) -> None:
    expected = os.getenv("AI_SERVICE_SHARED_SECRET", "")
    if not expected or not x_ai_service_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing service secret")
    if hmac.compare_digest(x_ai_service_secret, expected):
        return
    previous = os.getenv("AI_SERVICE_SHARED_SECRET_PREVIOUS", "")
    if previous and hmac.compare_digest(x_ai_service_secret, previous):
        return
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing service secret")
