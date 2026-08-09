"""
Segredo compartilhado apps/api <-> services/ai (Prompt 13). Este serviço não
tem CORS nem é chamado diretamente do browser (CONTRACT.md: "server-to-server
only") — isso por si só não é autenticação, só posicionamento de rede. Este
header é a camada de defesa em profundidade caso o serviço fique alcançável
de onde não deveria.

Falha fechado sempre: sem AI_SERVICE_SHARED_SECRET configurado, nenhuma
requisição passa (não há bypass "se a env var não existir, deixa passar").

Rotação com chave(s) anterior(es) (Prompt 18, lista desde o Prompt 23):
AI_SERVICE_SHARED_SECRET_PREVIOUS é opcional e só importa durante a troca do
segredo — permite fazer o deploy de services/ai com o novo valor antes de
apps/api (que só envia um valor, nunca "anterior") sem quebrar scoring/verify
no meio do rollout. Aceita uma lista separada por vírgula (ex.:
"old1,old2"), não só um único valor — isso viabiliza rotação encadeada
(trocar de novo antes de remover a anterior) sem nunca haver uma janela sem
uma chave válida em comum entre os dois lados. apps/api não precisa de um
equivalente porque só emite o header, nunca o verifica.
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
    previous_candidates = os.getenv("AI_SERVICE_SHARED_SECRET_PREVIOUS", "").split(",")
    for candidate in (c.strip() for c in previous_candidates):
        if candidate and hmac.compare_digest(x_ai_service_secret, candidate):
            return
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing service secret")
