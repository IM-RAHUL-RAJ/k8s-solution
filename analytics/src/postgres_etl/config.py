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
    host     = _require("POSTGRES_HOST")
    port     = os.environ.get("POSTGRES_PORT", "5432")
    dbname   = _require("POSTGRES_DB")
    user     = _require("POSTGRES_USER")
    password = _require("POSTGRES_PASSWORD")
    return (
        f"host={host} port={port} dbname={dbname} "
        f"user={user} password={password}"
    )


TRADES_DUCKDB_PATH: str = os.environ.get(
    "TRADES_DUCKDB_PATH", "data/trades.duckdb"
)

# Kafka configuration for trade-events consumer
KAFKA_BROKER = os.environ.get("KAFKA_BROKER", "localhost:9092")
KAFKA_TRADE_EVENTS_TOPIC = os.environ.get("KAFKA_TRADE_EVENTS_TOPIC", "trade-events")
KAFKA_CONSUMER_GROUP = os.environ.get("KAFKA_CONSUMER_GROUP", "analytics-loader")

# Watermark tracking for incremental loads
WATERMARK_FILE: str = os.environ.get(
    "WATERMARK_FILE", "data/.watermark"
)
