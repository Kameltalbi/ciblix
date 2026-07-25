from __future__ import annotations

import logging

logger = logging.getLogger("company_enricher")

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(asctime)s [%(levelname)s] company_enricher: %(message)s")
    )
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
