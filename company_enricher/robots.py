from __future__ import annotations

import urllib.robotparser
from functools import lru_cache
from urllib.parse import urlparse

import requests

from .config import settings
from .logging_utils import logger
from .rate_limit import rate_limiter


@lru_cache(maxsize=256)
def _robots_parser(robots_url: str) -> urllib.robotparser.RobotFileParser | None:
    rp = urllib.robotparser.RobotFileParser()
    try:
        host = urlparse(robots_url).hostname or ""
        rate_limiter.wait(host)
        resp = requests.get(
            robots_url,
            timeout=settings.request_timeout_s,
            headers={"User-Agent": settings.user_agent},
        )
        if resp.status_code >= 400:
            # Pas de robots.txt → on autorise (pratique courante), avec log
            logger.info("robots.txt absent ou erreur %s pour %s", resp.status_code, robots_url)
            return None
        rp.parse(resp.text.splitlines())
        return rp
    except Exception as exc:  # noqa: BLE001
        logger.warning("robots.txt illisible (%s): %s", robots_url, exc)
        return None


def can_fetch(url: str) -> bool:
    """True si le crawling est autorisé pour notre User-Agent."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.hostname:
            return False
        robots_url = f"{parsed.scheme}://{parsed.hostname}/robots.txt"
        rp = _robots_parser(robots_url)
        if rp is None:
            return True
        return bool(rp.can_fetch(settings.user_agent, url))
    except Exception as exc:  # noqa: BLE001
        logger.warning("can_fetch erreur pour %s: %s", url, exc)
        return True
