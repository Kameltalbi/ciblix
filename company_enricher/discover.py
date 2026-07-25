from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse, urlunparse

import requests

from .config import settings
from .logging_utils import logger
from .rate_limit import rate_limiter

# Annuaires / réseaux à exclure de la découverte du site officiel
_BLOCKED_HOST_FRAGMENTS = (
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "youtube.com",
    "tiktok.com",
    "pagesjaunes",
    "yellowpages",
    "yelp.com",
    "tripadvisor",
    "wikipedia.org",
    "crunchbase.com",
    "societe.com",
    "kompass.com",
    "tunisieindustrie",
    "annuaire",
    "google.com",
    "bing.com",
    "maps.google",
)


def normalize_url(raw: str | None) -> Optional[str]:
    if not raw or not str(raw).strip():
        return None
    text = str(raw).strip()
    if not re.match(r"^https?://", text, re.I):
        text = "https://" + text
    try:
        u = urlparse(text)
        if u.scheme not in ("http", "https") or not u.hostname:
            return None
        host = u.hostname.lower()
        if host in ("localhost",) or host.endswith(".local"):
            return None
        if re.match(r"^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)", host):
            return None
        path = u.path or "/"
        return urlunparse((u.scheme, host, path.rstrip("/") or "/", "", "", ""))
    except Exception:  # noqa: BLE001
        return None


def is_blocked_discovery_host(hostname: str) -> bool:
    h = (hostname or "").lower()
    return any(frag in h for frag in _BLOCKED_HOST_FRAGMENTS)


def _pick_best_result(items: list[dict], company_name: str) -> Optional[str]:
    name_tokens = [t for t in re.split(r"\W+", company_name.lower()) if len(t) > 2]
    scored: list[tuple[int, str]] = []
    for item in items:
        link = item.get("link") or item.get("url") or ""
        title = (item.get("title") or "").lower()
        snippet = (item.get("snippet") or item.get("description") or "").lower()
        norm = normalize_url(link)
        if not norm:
            continue
        host = urlparse(norm).hostname or ""
        if is_blocked_discovery_host(host):
            continue
        score = 0
        for tok in name_tokens:
            if tok in host:
                score += 5
            if tok in title:
                score += 2
            if tok in snippet:
                score += 1
        if host.startswith("www."):
            score += 1
        scored.append((score, norm))
    if not scored:
        return None
    scored.sort(key=lambda x: (-x[0], len(x[1])))
    return scored[0][1]


def discover_website(company_name: str) -> Optional[str]:
    """
    Trouve un site officiel probable via Serper / Bing / Google CSE.
    Retourne None si aucune API ou aucun résultat propre.
    """
    query = f"{company_name} site officiel"
    provider = settings.search_provider

    try:
        if provider == "serper" and settings.serper_api_key:
            return _search_serper(query, company_name)
        if provider == "bing" and settings.bing_api_key:
            return _search_bing(query, company_name)
        if provider == "google_cse" and settings.google_cse_key and settings.google_cse_cx:
            return _search_google_cse(query, company_name)
        # Fallback auto selon clés disponibles
        if settings.serper_api_key:
            return _search_serper(query, company_name)
        if settings.bing_api_key:
            return _search_bing(query, company_name)
        if settings.google_cse_key and settings.google_cse_cx:
            return _search_google_cse(query, company_name)
        logger.warning("Aucune API de recherche configurée — découverte impossible pour %s", company_name)
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning("Découverte web échouée pour %s: %s", company_name, exc)
        return None


def _search_serper(query: str, company_name: str) -> Optional[str]:
    rate_limiter.wait("google.serper.dev")
    resp = requests.post(
        "https://google.serper.dev/search",
        json={"q": query, "num": 8},
        headers={
            "X-API-KEY": settings.serper_api_key,
            "Content-Type": "application/json",
            "User-Agent": settings.user_agent,
        },
        timeout=settings.request_timeout_s,
    )
    resp.raise_for_status()
    organic = resp.json().get("organic") or []
    return _pick_best_result(organic, company_name)


def _search_bing(query: str, company_name: str) -> Optional[str]:
    rate_limiter.wait("api.bing.microsoft.com")
    resp = requests.get(
        "https://api.bing.microsoft.com/v7.0/search",
        params={"q": query, "count": 8},
        headers={
            "Ocp-Apim-Subscription-Key": settings.bing_api_key,
            "User-Agent": settings.user_agent,
        },
        timeout=settings.request_timeout_s,
    )
    resp.raise_for_status()
    web = (resp.json().get("webPages") or {}).get("value") or []
    items = [{"link": x.get("url"), "title": x.get("name"), "snippet": x.get("snippet")} for x in web]
    return _pick_best_result(items, company_name)


def _search_google_cse(query: str, company_name: str) -> Optional[str]:
    rate_limiter.wait("www.googleapis.com")
    resp = requests.get(
        "https://www.googleapis.com/customsearch/v1",
        params={
            "key": settings.google_cse_key,
            "cx": settings.google_cse_cx,
            "q": query,
            "num": 8,
        },
        headers={"User-Agent": settings.user_agent},
        timeout=settings.request_timeout_s,
    )
    resp.raise_for_status()
    items = resp.json().get("items") or []
    return _pick_best_result(items, company_name)
