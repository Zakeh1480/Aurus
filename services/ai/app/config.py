import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

_parents = Path(__file__).resolve().parents
if len(_parents) > 3:
    load_dotenv(_parents[3] / ".env")


@dataclass(frozen=True)
class Settings:
    host: str = "0.0.0.0"
    port: int = 8000

    verify_blur_variance_static_threshold: float = 15.0
    verify_blur_variance_low_detail_threshold: float = 60.0
    verify_face_min_area_ratio: float = 0.05
    verify_haar_scale_factor: float = 1.1
    verify_haar_min_neighbors: int = 5

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
