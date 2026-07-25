from __future__ import annotations

import threading
import time
from collections import defaultdict

from .config import settings


class DomainRateLimiter:
    """Max 1 requête / seconde / domaine (clé = hostname)."""

    def __init__(self, min_interval_s: float | None = None) -> None:
        self.min_interval = min_interval_s if min_interval_s is not None else settings.per_domain_min_interval_s
        self._last: dict[str, float] = defaultdict(float)
        self._lock = threading.Lock()

    def wait(self, hostname: str) -> None:
        host = (hostname or "").lower()
        with self._lock:
            now = time.monotonic()
            elapsed = now - self._last[host]
            delay = self.min_interval - elapsed
            if delay > 0:
                time.sleep(delay)
            self._last[host] = time.monotonic()


rate_limiter = DomainRateLimiter()
