from __future__ import annotations

import json
import re
from typing import Optional

import requests

from .config import settings
from .logging_utils import logger

SYSTEM_PROMPT = (
    "Résume l'activité de cette entreprise en 2-3 phrases, en te basant EXCLUSIVEMENT "
    "sur le texte fourni ci-dessous. Si une information n'est pas présente dans le texte, "
    "ne l'invente pas et indique 'non disponible'. Ne déduis jamais un email, téléphone, "
    "ou nom de dirigeant qui n'apparaît pas explicitement dans le texte fourni. "
    "Réponds UNIQUEMENT en JSON valide avec les clés: "
    '{"resume_activite": string|null, "secteur_probable": string|null}'
)


def _truncate(text: str) -> str:
    t = re.sub(r"\n{3,}", "\n\n", (text or "").strip())
    if len(t) <= settings.max_text_for_llm:
        return t
    return t[: settings.max_text_for_llm] + "\n…"


def summarize_activity(company_name: str, page_text: str) -> tuple[Optional[str], Optional[str]]:
    """
    Retourne (resume_activite, secteur_probable) depuis le texte scrapé uniquement.
    """
    text = _truncate(page_text)
    if len(text) < 40:
        return None, None

    user_content = (
        f"Entreprise: {company_name}\n\n"
        f"--- TEXTE EXTRAIT DU SITE (source unique) ---\n{text}\n--- FIN ---"
    )

    try:
        if settings.llm_provider == "anthropic" and settings.anthropic_api_key:
            return _call_anthropic(user_content)
        if settings.openai_api_key:
            return _call_openai(user_content)
        if settings.anthropic_api_key:
            return _call_anthropic(user_content)
        logger.warning("Aucune clé LLM — résumé non généré pour %s", company_name)
        return None, None
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM résumé échoué pour %s: %s", company_name, exc)
        return None, None


def _parse_json_payload(raw: str) -> tuple[Optional[str], Optional[str]]:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    data = json.loads(raw)
    resume = data.get("resume_activite")
    secteur = data.get("secteur_probable")
    if isinstance(resume, str):
        resume = resume.strip() or None
        if resume and resume.lower() in ("non disponible", "n/a", "none", "null"):
            resume = None
    else:
        resume = None
    if isinstance(secteur, str):
        secteur = secteur.strip() or None
        if secteur and secteur.lower() in ("non disponible", "n/a", "none", "null"):
            secteur = None
    else:
        secteur = None
    return resume, secteur


def _call_openai(user_content: str) -> tuple[Optional[str], Optional[str]]:
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
            "User-Agent": settings.user_agent,
        },
        json={
            "model": settings.openai_model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
        },
        timeout=45,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    return _parse_json_payload(content)


def _call_anthropic(user_content: str) -> tuple[Optional[str], Optional[str]]:
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": settings.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
            "User-Agent": settings.user_agent,
        },
        json={
            "model": settings.anthropic_model,
            "max_tokens": 500,
            "temperature": 0,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": user_content}],
        },
        timeout=45,
    )
    resp.raise_for_status()
    blocks = resp.json().get("content") or []
    text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
    return _parse_json_payload(text)
