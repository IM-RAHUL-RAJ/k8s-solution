# Configuration for the postgres_etl pipeline.
#
# All Postgres connection details are read from environment variables
# (or a .env file in the analytics project root), consistent with how
# the Fauxnance pipeline reads FAUXNANCE_API_KEY / FAUXNANCE_BASE_URL.
#
# Required .env entries:
#   POSTGRES_HOST      e.g. localhost
#   POSTGRES_PORT      e.g. 5432
#   POSTGRES_DB        e.g. trading
#   POSTGRES_USER      e.g. postgres
#   POSTGRES_PASSWORD  e.g. secret
#
# Optional .env entries:
#   TRADES_DUCKDB_PATH  path to the trades DuckDB file
#                       defaults to "data/trades.duckdb"

from __future__ import annotations

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def _require(key: str) -> str:
    value = os.environ.get(key)
    if not value:
        raise RuntimeError(
            f"Required environment variable '{key}' is not set. "
            f"Add it to your .env file."
        )
    return value


def get_postgres_dsn() -> str:
    """Build a psycopg2 DSN string from environment variables."""
    host     = _require("POSTGRES_HOST")
    port     = os.environ.get("POSTGRES_PORT", "5432")
    dbname   = _require("POSTGRES_DB")
    user     = _require("POSTGRES_USER")
    password = _require("POSTGRES_PASSWORD")
    return (
        f"host={host} port={port} dbname={dbname} "
        f"user={user} password={password}"
    )


# Path to the dedicated DuckDB file for trade data.
# Intentionally separate from analytics.duckdb (Fauxnance candle data).
TRADES_DUCKDB_PATH: str = os.environ.get(
    "TRADES_DUCKDB_PATH", "data/trades.duckdb"
)
