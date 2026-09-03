# EXTRACT step for the Postgres ETL pipeline.
#
# Mirrors analytics_etl/extract.py:
#   extract_candles()  →  extract_orders()
#
# There is no disk cache here (unlike the Fauxnance pipeline) because
# Postgres is a local operational database — latency is negligible and
# the watermark mechanism already prevents re-fetching old rows.

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from .client import PostgresClient

logger = logging.getLogger(__name__)


def extract_orders(
    watermark: datetime,
    client: PostgresClient | None = None,
) -> list[dict[str, Any]]:
    """
    Extract all orders created at or after `watermark` from Postgres.

    Returns a list of raw row dicts straight from the database.
    Callers should not interpret these rows — pass them to transform().

    Parameters
    ----------
    watermark : datetime
        Only orders with created_at >= watermark are returned.
        On first run, pass datetime.min or a suitable epoch date.
    client : PostgresClient | None
        Injectable for testing. A new client is created if not provided.
    """
    owned = client is None
    if owned:
        client = PostgresClient()

    try:
        rows = client.get_orders_since(watermark)
        logger.info("EXTRACT complete: %d raw rows", len(rows))
        return rows
    finally:
        if owned:
            client.close()
