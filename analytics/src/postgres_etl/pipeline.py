from __future__ import annotations

import logging
import sys

from .extract import extract_orders
from .transform import transform
from .load import load, get_watermark
from .errors import PostgresConnectionError, PostgresExtractError

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# MAIN PIPELINE
# ---------------------------------------------------------------------------


def run_pipeline(watermark=None):
    """
    Run the Postgres → DuckDB ETL pipeline.

    Steps
    -----
    1. Determine watermark (MAX created_at already in trades.duckdb, or 90 d ago).
    2. EXTRACT: pull all orders since watermark from Postgres.
    3. TRANSFORM: validate and shape rows; quarantine bad ones.
    4. LOAD: upsert dimensions and insert fact_trades into trades.duckdb.

    Parameters
    ----------
    watermark : datetime | None
        Override the automatic watermark. Useful for backfills.

    Returns
    -------
    int
        Number of new fact_trades rows inserted.
    """
    logger.info("=" * 60)
    logger.info("STARTING POSTGRES ETL PIPELINE")
    logger.info("=" * 60)

    # WATERMARK
    if watermark is None:
        watermark = get_watermark()

    logger.info("Watermark: %s", watermark.isoformat())

    # EXTRACT
    try:
        raw_rows = extract_orders(watermark)
    except PostgresConnectionError as exc:
        logger.error("CONNECTION FAILED: %s", exc)
        sys.exit(1)
    except PostgresExtractError as exc:
        logger.error("EXTRACT FAILED: %s", exc)
        sys.exit(1)

    if not raw_rows:
        logger.info("No new orders since watermark — nothing to load.")
        logger.info("=" * 60)
        logger.info("PIPELINE COMPLETE (0 rows)")
        logger.info("=" * 60)
        return 0

    logger.info("Extracted %d raw rows", len(raw_rows))

    # TRANSFORM
    try:
        result = transform(raw_rows)
    except Exception:
        logger.exception("TRANSFORM FAILED (unexpected error)")
        sys.exit(1)

    # QUARANTINE report
    if result["quarantine"]:
        logger.warning(
            "%d rows quarantined during transform:", len(result["quarantine"])
        )
        for item in result["quarantine"]:
            logger.warning(
                "  source_order_id=%r  reason=%s",
                item["row"].get("source_order_id"),
                item["reason"],
            )

    if not result["clean"]:
        logger.warning("All rows quarantined — nothing to load.")
        return 0

    # LOAD
    try:
        rows_loaded = load(result)
    except Exception:
        logger.exception("LOAD FAILED")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("PIPELINE COMPLETE")
    logger.info("ROWS INSERTED INTO fact_trades: %d", rows_loaded)
    logger.info("=" * 60)

    return rows_loaded


def main():
    run_pipeline()


if __name__ == "__main__":
    main()
