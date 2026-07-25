"""Tests unitaires légers (sans réseau)."""

from company_enricher.extract import extract_emails, extract_phones, extract_socials, pick_best_email
from company_enricher.discover import normalize_url, is_blocked_discovery_host
from company_enricher.models import CompanyEnrichmentResult


def test_normalize_url():
    assert normalize_url("example.com").startswith("https://example.com")
    assert normalize_url("https://ok.test/path") == "https://ok.test/path"
    assert normalize_url("http://127.0.0.1") is None


def test_blocked_hosts():
    assert is_blocked_discovery_host("www.linkedin.com")
    assert not is_blocked_discovery_host("www.archibat.tn")


def test_emails_prefer_generic():
    html = 'Contact: <a href="mailto:jean.dupont@gmail.com">x</a> info@archibat.tn'
    emails = extract_emails(html, html)
    best, kind = pick_best_email(emails)
    assert best == "info@archibat.tn"
    assert kind == "generique"


def test_nominatif_flag():
    emails = extract_emails("jean.dupont@gmail.com", "jean.dupont@gmail.com")
    best, kind = pick_best_email(emails)
    assert best == "jean.dupont@gmail.com"
    assert kind == "nominatif"


def test_phones_tunisia():
    phones = extract_phones("Appelez le +216 71 123 456", "")
    assert phones
    assert phones[0].startswith("+216")


def test_socials():
    html = '<a href="https://www.linkedin.com/company/acme">L</a>'
    s = extract_socials(html)
    assert s["linkedin"] and "linkedin.com" in s["linkedin"]


def test_schema_dump():
    r = CompanyEnrichmentResult(entreprise="Test", source_confiance="non_trouve")
    d = r.model_dump_public()
    assert d["entreprise"] == "Test"
    assert "email_contact" in d
    assert "reseaux_sociaux" in d
