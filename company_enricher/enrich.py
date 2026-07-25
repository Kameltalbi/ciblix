from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Optional

from .config import settings
from .discover import discover_website, normalize_url
from .extract import extract_all, pick_best_email
from .logging_utils import logger
from .models import CompanyEnrichmentResult, ReseauxSociaux, empty_result
from .scrape import crawl_company_site
from .summarize import summarize_activity


def enrich_company(nom: str, url: str | None = None) -> dict:
    """
    Enrichit une fiche entreprise à partir de son site web.

    Args:
        nom: Nom de l'entreprise
        url: URL du site (optionnel — découverte web sinon)

    Returns:
        dict conforme au schema JSON (validé Pydantic)
    """
    name = (nom or "").strip() or "Entreprise"
    try:
        result = _enrich_company_inner(name, url)
        return result.model_dump_public()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Pipeline enrich_company a levé pour %s: %s", name, exc)
        return empty_result(name, f"pipeline:{exc}").model_dump_public()


def _enrich_company_inner(name: str, url: str | None) -> CompanyEnrichmentResult:
    source: str = "non_trouve"
    site = normalize_url(url) if url else None

    if site:
        source = "site_officiel"
    else:
        discovered = discover_website(name)
        if discovered:
            site = discovered
            source = "recherche_web"
        else:
            logger.info("Site non trouvé pour %s", name)
            return empty_result(name, "site_non_trouve")

    crawl = crawl_company_site(site)
    if not crawl.ok:
        errs = crawl.errors or ["contenu_vide"]
        for e in errs:
            logger.info("Échec crawl %s — %s", name, e)
        return CompanyEnrichmentResult(
            entreprise=name,
            url_site=site,
            source_confiance="non_trouve",
            erreurs=errs,
        )

    contacts = extract_all(crawl.combined_html, crawl.combined_text)
    email, email_type = pick_best_email(contacts.emails)
    phone = contacts.phones[0] if contacts.phones else None

    resume, secteur = summarize_activity(name, crawl.combined_text)

    return CompanyEnrichmentResult(
        entreprise=name,
        url_site=site,
        email_contact=email,
        type_email=email_type,
        telephone=phone,
        adresse=contacts.address,
        reseaux_sociaux=ReseauxSociaux(**contacts.socials),
        resume_activite=resume,
        secteur_probable=secteur,
        source_confiance=source if source in ("site_officiel", "recherche_web") else "site_officiel",
        erreurs=crawl.errors[:10],
    )


def enrich_companies_batch(
    companies: list[dict[str, Any]] | list[tuple[str, Optional[str]]],
    max_workers: int | None = None,
) -> list[dict]:
    """
    Enrichit une liste d'entreprises avec parallélisation bornée (défaut 5).

    Accepte:
      - [{"nom": "...", "url": "..."}, ...]
      - [("Nom", "https://..."), ...]
    """
    workers = max(1, min(max_workers or settings.batch_max_workers, 5))
    jobs: list[tuple[int, str, Optional[str]]] = []

    for idx, item in enumerate(companies):
        if isinstance(item, dict):
            nom = str(item.get("nom") or item.get("name") or item.get("entreprise") or "").strip()
            url = item.get("url") or item.get("url_site") or item.get("website")
            url = str(url).strip() if url else None
        elif isinstance(item, (list, tuple)) and len(item) >= 1:
            nom = str(item[0]).strip()
            url = str(item[1]).strip() if len(item) > 1 and item[1] else None
        else:
            nom, url = "", None
        jobs.append((idx, nom or f"Entreprise-{idx+1}", url))

    results: list[Optional[dict]] = [None] * len(jobs)

    def _run(job: tuple[int, str, Optional[str]]) -> tuple[int, dict]:
        i, nom, url = job
        return i, enrich_company(nom, url)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_run, job) for job in jobs]
        for fut in as_completed(futures):
            i, data = fut.result()
            results[i] = data

    return [r or empty_result("?").model_dump_public() for r in results]
