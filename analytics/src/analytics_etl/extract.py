#EXTRACT PIPELINE
from __future__ import annotations

from .cache import RawResponseCache
from .client import FauxnanceClient
from .config import CACHE_DIR


def extract_candles(
    symbol: str,
    from_date: str | None = None,
    to_date: str | None = None,
    client: FauxnanceClient | None = None,
    cache: RawResponseCache | None = None,
) -> dict:
    cache = cache or RawResponseCache(CACHE_DIR)
    client = client or FauxnanceClient()

    range_key = f"{from_date or 'default'}_{to_date or 'default'}"

    cached = cache.get(symbol, range_key)
    if cached is not None:
        return cached

    raw = client.get_candles(symbol, from_date=from_date, to_date=to_date)
    cache.set(symbol, range_key, raw)
    return raw


