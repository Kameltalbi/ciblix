from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from .config import settings
from .logging_utils import logger
from .rate_limit import rate_limiter
from .robots import can_fetch

CONTACT_PATHS = (
    "/",
    "/contact",
    "/contacts",
    "/contact-us",
    "/contactez-nous",
    "/nous-contacter",
    "/about",
    "/about-us",
    "/a-propos",
    "/a-propos-de-nous",
    "/qui-sommes-nous",
    "/our-company",
    "/entreprise",
    "/company",
    # variantes AR (latinisées)
    "/ittisal",
    "/man-nahno",
)


@dataclass
class PageFetch:
    url: str
    html: str = ""
    text: str = ""
    error: Optional[str] = None
    via: str = "requests"


@dataclass
class SiteCrawlResult:
    pages: list[PageFetch] = field(default_factory=list)
    combined_html: str = ""
    combined_text: str = ""
    errors: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return bool(self.combined_text.strip() or self.combined_html.strip())


def _origin(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.hostname}"


def _candidate_urls(seed: str) -> list[str]:
    origin = _origin(seed)
    seen: set[str] = set()
    out: list[str] = []
    # Seed first (homepage or given page)
    for raw in [seed, *[urljoin(origin + "/", path.lstrip("/")) for path in CONTACT_PATHS]]:
        u = raw.rstrip("/") or raw
        if u not in seen:
            seen.add(u)
            out.append(u if u.endswith("/") or "." in urlparse(u).path.split("/")[-1] else u)
    # Prefer unique paths
    return out[: settings.max_pages_per_company]


def _html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "iframe"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    return "\n".join(lines)


def _looks_js_shell(html: str, text: str) -> bool:
    if len(text.strip()) >= 280:
        return False
    low = html.lower()
    markers = (
        'id="root"',
        'id="__next"',
        "ng-version=",
        "data-reactroot",
        "__NUXT__",
        "webpackJsonp",
    )
    return any(m.lower() in low for m in markers) or len(text.strip()) < 80


def fetch_with_requests(url: str) -> PageFetch:
    host = urlparse(url).hostname or ""
    rate_limiter.wait(host)
    try:
        resp = requests.get(
            url,
            timeout=settings.request_timeout_s,
            headers={
                "User-Agent": settings.user_agent,
                "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,ar;q=0.7",
            },
            allow_redirects=True,
        )
        if resp.status_code >= 400:
            return PageFetch(url=url, error=f"http_{resp.status_code}", via="requests")
        html = (resp.text or "")[: settings.max_html_chars]
        return PageFetch(url=str(resp.url), html=html, text=_html_to_text(html), via="requests")
    except requests.Timeout:
        return PageFetch(url=url, error="timeout", via="requests")
    except Exception as exc:  # noqa: BLE001
        return PageFetch(url=url, error=f"requests:{exc}", via="requests")


def fetch_with_playwright(url: str) -> PageFetch:
    if not settings.playwright_enabled:
        return PageFetch(url=url, error="playwright_disabled", via="playwright")
    host = urlparse(url).hostname or ""
    rate_limiter.wait(host)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        logger.warning("Playwright non installé — skip JS pour %s", url)
        return PageFetch(url=url, error="playwright_missing", via="playwright")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(user_agent=settings.user_agent, locale="fr-FR")
            page = context.new_page()
            page.set_default_timeout(int(settings.request_timeout_s * 1000))
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_timeout(800)
            html = page.content()[: settings.max_html_chars]
            browser.close()
        return PageFetch(url=url, html=html, text=_html_to_text(html), via="playwright")
    except Exception as exc:  # noqa: BLE001
        return PageFetch(url=url, error=f"playwright:{exc}", via="playwright")


def fetch_page(url: str, allow_retry: bool = True) -> PageFetch:
    if not can_fetch(url):
        logger.info("robots.txt interdit: %s", url)
        return PageFetch(url=url, error="robots_txt_interdit", via="none")

    page = fetch_with_requests(url)
    if page.error == "timeout" and allow_retry and settings.max_retries >= 1:
        logger.info("Retry après timeout: %s", url)
        time.sleep(settings.retry_delay_s)
        page = fetch_with_requests(url)

    if page.html and _looks_js_shell(page.html, page.text):
        logger.info("Contenu JS probable — bascule Playwright: %s", url)
        js_page = fetch_with_playwright(url)
        if js_page.html and not js_page.error:
            return js_page
        if js_page.error:
            page.error = page.error or js_page.error

    return page


def crawl_company_site(seed_url: str) -> SiteCrawlResult:
    result = SiteCrawlResult()
    for url in _candidate_urls(seed_url):
        page = fetch_page(url)
        if page.error:
            result.errors.append(f"{url}: {page.error}")
            logger.info("Échec fetch %s — %s", url, page.error)
            continue
        if not page.html and not page.text:
            result.errors.append(f"{url}: parsing_vide")
            logger.info("Parsing vide: %s", url)
            continue
        result.pages.append(page)

    result.combined_html = "\n".join(p.html for p in result.pages)
    # Déduplique un peu le texte
    chunks: list[str] = []
    seen: set[str] = set()
    for p in result.pages:
        key = p.text[:200]
        if key in seen:
            continue
        seen.add(key)
        chunks.append(p.text)
    result.combined_text = "\n\n".join(chunks)
    return result
