"""Configuração de runtime — via os.getenv, sem dependência extra (pydantic-settings)."""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# .env vive na raiz do monorepo (convenção do Prompt 0, mesma de apps/api/src/main.ts)
# — services/ai/app/config.py está 3 níveis abaixo dela nesse checkout. Em
# produção/Docker (services/ai/Dockerfile copia só ./app para /app/app) essa
# profundidade não existe — não há .env físico lá mesmo, as env vars chegam
# via o container/plataforma diretamente — então só tenta se os 3 níveis
# existirem. load_dotenv nunca sobrescreve uma env var já setada
# (override=False, default), então não quebra testes que setam
# AI_SERVICE_SHARED_SECRET manualmente antes do import.
_parents = Path(__file__).resolve().parents
if len(_parents) > 3:
    load_dotenv(_parents[3] / ".env")


@dataclass(frozen=True)
class Settings:
    host: str = "0.0.0.0"
    port: int = 8000
    # Thresholds do /verify (Prompt 6b) — ver app/verification.py para o uso.
    verify_blur_variance_static_threshold: float = 15.0
    verify_blur_variance_low_detail_threshold: float = 60.0
    verify_face_min_area_ratio: float = 0.05
    verify_haar_scale_factor: float = 1.1
    verify_haar_min_neighbors: int = 5
    # Rate limit por IP (Prompt 28) — default generoso acima do volume
    # legítimo esperado (apps/api chama /score/aggregate 2x por tick de
    # score, MATCH_SCORE_TICK_INTERVAL_MS default 5000ms, por partida ativa),
    # ainda assim um teto real contra flood de segredo vazado/bug em loop.
    rate_limit_max_requests: int = 1200
    rate_limit_window_seconds: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings(
        port=int(os.getenv("AI_SERVICE_PORT", "8000")),
        verify_blur_variance_static_threshold=float(
            os.getenv("ANTI_CHEAT_BLUR_VARIANCE_STATIC_THRESHOLD", "15.0")
        ),
        verify_blur_variance_low_detail_threshold=float(
            os.getenv("ANTI_CHEAT_BLUR_VARIANCE_LOW_DETAIL_THRESHOLD", "60.0")
        ),
        verify_face_min_area_ratio=float(os.getenv("ANTI_CHEAT_FACE_MIN_AREA_RATIO", "0.05")),
        rate_limit_max_requests=int(os.getenv("AI_SERVICE_RATE_LIMIT_MAX_REQUESTS", "1200")),
        rate_limit_window_seconds=int(os.getenv("AI_SERVICE_RATE_LIMIT_WINDOW_SECONDS", "60")),
    )
