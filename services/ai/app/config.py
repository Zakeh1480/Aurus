"""Configuração de runtime — via os.getenv, sem dependência extra (pydantic-settings)."""

import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    host: str = "0.0.0.0"
    port: int = 8000


@lru_cache
def get_settings() -> Settings:
    return Settings(port=int(os.getenv("AI_SERVICE_PORT", "8000")))
