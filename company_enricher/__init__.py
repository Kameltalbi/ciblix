"""
company_enricher — enrichissement fiche entreprise via site web (Ciblix).

Usage:
    from company_enricher import enrich_company, enrich_companies_batch

    result = enrich_company("Archibat", url="https://www.archibat.com")
    results = enrich_companies_batch([{"nom": "…", "url": None}, …])
"""

from .enrich import enrich_companies_batch, enrich_company
from .models import CompanyEnrichmentResult

__all__ = [
    "CompanyEnrichmentResult",
    "enrich_company",
    "enrich_companies_batch",
]

__version__ = "1.0.0"
