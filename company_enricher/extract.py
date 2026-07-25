from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal, Optional
from urllib.parse import unquote, urlparse

GENERIC_LOCAL_PARTS = (
    "contact",
    "info",
    "commercial",
    "commerciale",
    "sales",
    "hello",
    "bonjour",
    "admin",
    "support",
    "service",
    "office",
    "accueil",
    "direction",
    "marketing",
    "rh",
    "hr",
)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
MAILTO_RE = re.compile(r"mailto:([^\"'\s>]+)", re.I)

# Tunisie +216 XX XXX XXX / 71 XXX XXX / international
PHONE_RE = re.compile(
    r"(?:(?:\+|00)\s*216[\s\-.]*)?(?:0?\s*[2-9](?:[\s\-.]?\d){7,8})"
    r"|(?:\+|00)\s*[1-9]\d{0,3}[\s\-.]*(?:\(?\d{1,4}\)?[\s\-.]*){2,5}\d{2,4}"
)

ADDRESS_HINT_RE = re.compile(
    r"(?:adresse|address|siège|siege|bureau|office|localisation)\s*[:\-]?\s*(.{10,160})",
    re.I,
)

SOCIAL_DOMAINS = {
    "linkedin": ("linkedin.com",),
    "facebook": ("facebook.com", "fb.com", "fb.me"),
    "instagram": ("instagram.com",),
}

BAD_EMAIL_DOMAINS = (
    "example.com",
    "sentry.io",
    "wixpress.com",
    "domain.com",
    "email.com",
    "yourname.com",
    "schema.org",
)


@dataclass
class ExtractedContacts:
    emails: list[tuple[str, Literal["generique", "nominatif"]]] = field(default_factory=list)
    phones: list[str] = field(default_factory=list)
    address: Optional[str] = None
    socials: dict[str, Optional[str]] = field(
        default_factory=lambda: {"linkedin": None, "facebook": None, "instagram": None}
    )


def _normalize_email(raw: str) -> Optional[str]:
    e = unquote(raw).split("?")[0].strip().lower().rstrip(".,;)")
    if not EMAIL_RE.fullmatch(e):
        return None
    if any(e.endswith("@" + d) or e.endswith("." + d) for d in BAD_EMAIL_DOMAINS):
        return None
    if e.endswith((".png", ".jpg", ".gif", ".webp", ".svg")):
        return None
    return e


def _email_type(email: str) -> Literal["generique", "nominatif"]:
    local = email.split("@", 1)[0]
    base = local.split("+", 1)[0].lower()
    domain = email.split("@", 1)[1].lower()

    free_mail = ("gmail.com", "yahoo.", "hotmail.", "outlook.", "live.", "icloud.", "proton.")
    if any(domain == f or domain.startswith(f) or f.rstrip(".") in domain for f in free_mail):
        return "nominatif"

    parts = re.split(r"[._\-]", base)
    if parts and parts[0] in GENERIC_LOCAL_PARTS:
        return "generique"
    if base in GENERIC_LOCAL_PARTS:
        return "generique"
    # prenom.nom@domaine-entreprise → nominatif
    if len(parts) >= 2 and all(len(p) >= 2 for p in parts[:2]):
        return "nominatif"
    return "generique"


def _normalize_phone(raw: str) -> Optional[str]:
    digits = re.sub(r"[^\d+]", "", raw)
    if digits.startswith("00216"):
        digits = "+216" + digits[5:]
    elif digits.startswith("216") and len(digits) >= 11:
        digits = "+" + digits
    elif digits.startswith("0") and len(re.sub(r"\D", "", digits)) in (8, 9):
        # local TN without country code
        local = re.sub(r"\D", "", digits)
        if len(local) == 8:
            digits = "+216" + local
    clean = re.sub(r"[^\d+]", "", digits)
    digit_count = len(re.sub(r"\D", "", clean))
    if digit_count < 8 or digit_count > 15:
        return None
    return clean


def extract_emails(html: str, text: str) -> list[tuple[str, Literal["generique", "nominatif"]]]:
    found: dict[str, Literal["generique", "nominatif"]] = {}
    for m in MAILTO_RE.finditer(html or ""):
        e = _normalize_email(m.group(1))
        if e:
            found[e] = _email_type(e)
    for m in EMAIL_RE.finditer(f"{html}\n{text}"):
        e = _normalize_email(m.group(0))
        if e:
            found[e] = _email_type(e)

    # Prefer generic first
    items = list(found.items())
    items.sort(key=lambda x: (0 if x[1] == "generique" else 1, x[0]))
    return items[:12]


def extract_phones(text: str, html: str = "") -> list[str]:
    blob = f"{text}\n{html}"
    # Prefer tel: links
    phones: list[str] = []
    seen: set[str] = set()
    for m in re.finditer(r"tel:([^\"'\s>]+)", blob, re.I):
        p = _normalize_phone(unquote(m.group(1)))
        if p and p not in seen:
            seen.add(p)
            phones.append(p)
    for m in PHONE_RE.finditer(blob):
        p = _normalize_phone(m.group(0))
        if p and p not in seen:
            seen.add(p)
            phones.append(p)
    return phones[:8]


def extract_address(text: str) -> Optional[str]:
    m = ADDRESS_HINT_RE.search(text or "")
    if m:
        addr = re.sub(r"\s+", " ", m.group(1)).strip(" .-")
        if 10 <= len(addr) <= 180:
            return addr
    # Heuristic: line with rue / avenue / BP / Tunis / etc.
    for line in (text or "").splitlines():
        if re.search(r"\b(rue|avenue|av\.|bp\b|tunis|sfax|sousse|ariana|manouba)\b", line, re.I):
            cleaned = re.sub(r"\s+", " ", line).strip()
            if 12 <= len(cleaned) <= 180:
                return cleaned
    return None


def extract_socials(html: str) -> dict[str, Optional[str]]:
    out: dict[str, Optional[str]] = {"linkedin": None, "facebook": None, "instagram": None}
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html or "", flags=re.I)
    for href in hrefs:
        try:
            host = (urlparse(href).hostname or "").lower()
        except Exception:  # noqa: BLE001
            continue
        for key, domains in SOCIAL_DOMAINS.items():
            if out[key]:
                continue
            if any(d in host for d in domains):
                # Skip share widgets noise when possible
                if "share" in href.lower() and "linkedin.com/company" not in href.lower():
                    if "linkedin.com/in/" not in href.lower() and "linkedin.com/company" not in href.lower():
                        continue
                out[key] = href.split("?")[0]
    return out


def extract_all(html: str, text: str) -> ExtractedContacts:
    return ExtractedContacts(
        emails=extract_emails(html, text),
        phones=extract_phones(text, html),
        address=extract_address(text),
        socials=extract_socials(html),
    )


def pick_best_email(
    emails: list[tuple[str, Literal["generique", "nominatif"]]],
) -> tuple[Optional[str], Optional[Literal["generique", "nominatif"]]]:
    if not emails:
        return None, None
    generics = [e for e in emails if e[1] == "generique"]
    if generics:
        # Prefer contact@ / info@ / commercial@
        priority = ("contact@", "info@", "commercial@", "sales@", "hello@")
        for pref in priority:
            for email, kind in generics:
                if email.startswith(pref):
                    return email, kind
        return generics[0]
    # Only nominative available — flag for RGPD
    return emails[0]
