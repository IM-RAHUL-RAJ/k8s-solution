"""
Dead-letter handler for rows that fail data quality checks.

A dead-lettered row is recorded with:
  - The reason it failed validation
  - The batch UUID it belongs to (for grouping related failures)
  - The raw row as JSON (for investigation)
  - A timestamp of when it failed

Dead-lettering ensures that data loss is prevented: a row that fails is
recorded and can be investigated on Monday morning, not silently dropped.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import duckdb

logger = logging.getLogger(__name__)


def _generate_dead_letter_key() -> int:
    """Generate a surrogate key for a dead-letter row."""
    import hashlib
    ts = datetime.now(tz=timezone.utc).isoformat()
    return int(
        hashlib.sha256(f"{ts}-{uuid4()}".encode("utf-8")).hexdigest()[:15], 16
    )


def record_dead_letter(
    conn: duckdb.DuckDBPyConnection,
    source_order_id: str,
    reason: str,
    batch_id: str,
    raw_row: dict[str, Any],
) -> bool:
    """
    Record a row that failed validation into the dead-letter table.

    Idempotent: re-recording the same source_order_id is a no-op due to the
    unique constraint on source_order_id.

    Args:
        conn: DuckDB connection
        source_order_id: The operational orders.id
        reason: Human-readable failure reason
        batch_id: UUID of the load batch (for grouping)
        raw_row: The raw row data (as dict)

    Returns:
        True if the row was inserted, False if it was already present
    """
    dead_letter_key = _generate_dead_letter_key()
    raw_json = json.dumps(raw_row, default=str)

    try:
        result = conn.execute(
            """
            INSERT INTO dead_letter_trades
            (dead_letter_key, source_order_id, failure_reason, batch_id, raw_row)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING
            RETURNING dead_letter_key
            """,
            [dead_letter_key, source_order_id, reason, batch_id, raw_json],
        ).fetchone()

        if result:
            logger.warning(
                "DEAD_LETTER: source_order_id=%r reason=%s batch=%s",
                source_order_id,
                reason,
                batch_id,
            )
            return True
        return False

    except Exception as exc:
        logger.error(
            "Failed to record dead letter for %r: %s",
            source_order_id,
            exc,
        )
        raise


def get_dead_letter_count(
    conn: duckdb.DuckDBPyConnection,
    batch_id: str | None = None,
) -> int:
    """Get count of dead-lettered rows, optionally for a specific batch."""
    if batch_id:
        result = conn.execute(
            "SELECT COUNT(*) FROM dead_letter_trades WHERE batch_id = ?",
            [batch_id],
        ).fetchone()
    else:
        result = conn.execute(
            "SELECT COUNT(*) FROM dead_letter_trades"
        ).fetchone()

    return result[0] if result else 0
