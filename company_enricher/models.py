from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ReseauxSociaux(BaseModel):
    linkedin: Optional[str] = None
    facebook: Optional[str] = None
    instagram: Optional[str] = None


class CompanyEnrichmentResult(BaseModel):
    entreprise: str
    url_site: Optional[str] = None
    email_contact: Optional[str] = None
    type_email: Optional[Literal["generique", "nominatif"]] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = None
    reseaux_sociaux: ReseauxSociaux = Field(default_factory=ReseauxSociaux)
    resume_activite: Optional[str] = None
    secteur_probable: Optional[str] = None
    source_confiance: Literal["site_officiel", "recherche_web", "non_trouve"] = "non_trouve"
    date_extraction: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    erreurs: list[str] = Field(default_factory=list)

    def model_dump_public(self) -> dict:
        """Dict JSON (schema produit + champs RGPD utiles)."""
        data = self.model_dump()
        return data


def empty_result(nom: str, *erreurs: str) -> CompanyEnrichmentResult:
    return CompanyEnrichmentResult(
        entreprise=nom,
        source_confiance="non_trouve",
        erreurs=[e for e in erreurs if e],
    )
