from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    user_agent: str = (
        "CiblixCompanyEnricher/1.0 (+https://ciblix.com; prospecting-agent; contact=support@ciblix.com)"
    )
    request_timeout_s: float = 10.0
    per_domain_min_interval_s: float = 1.0
    max_retries: int = 1
    retry_delay_s: float = 5.0
    max_pages_per_company: int = 5
    max_html_chars: int = 400_000
    max_text_for_llm: int = 12_000
    batch_max_workers: int = 5
    playwright_enabled: bool = True
    # Recherche web (optionnelle)
    search_provider: str = os.getenv("COMPANY_ENRICHER_SEARCH_PROVIDER", "serper").strip().lower()
    serper_api_key: str = os.getenv("SERPER_API_KEY", "").strip()
    bing_api_key: str = os.getenv("BING_SEARCH_API_KEY", "").strip()
    google_cse_key: str = os.getenv("GOOGLE_CSE_API_KEY", "").strip()
    google_cse_cx: str = os.getenv("GOOGLE_CSE_CX", "").strip()
    # LLM
    llm_provider: str = os.getenv("COMPANY_ENRICHER_LLM_PROVIDER", "openai").strip().lower()
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "").strip()
    openai_model: str = os.getenv("COMPANY_ENRICHER_OPENAI_MODEL", "gpt-4o-mini").strip()
    anthropic_api_key: str = os.getenv("ANTHROPIC_API_KEY", "").strip()
    anthropic_model: str = os.getenv(
        "COMPANY_ENRICHER_ANTHROPIC_MODEL", "claude-3-5-haiku-latest"
    ).strip()


settings = Settings()
