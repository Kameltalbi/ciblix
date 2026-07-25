"""CLI rapide: python -m company_enricher "Nom" [url]"""

from __future__ import annotations

import json
import sys

from .enrich import enrich_company


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args:
        print('Usage: python -m company_enricher "Nom entreprise" [url]', file=sys.stderr)
        return 2
    nom = args[0]
    url = args[1] if len(args) > 1 else None
    print(json.dumps(enrich_company(nom, url), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
