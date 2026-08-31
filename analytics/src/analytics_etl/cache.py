#Cache the RAW response to disk, file name:  by inst symbol + date range. 

from __future__ import annotations

import json
import os
from pathlib import Path


def _cache_key(symbol: str, range_key: str) -> str:
    safe_symbol = symbol.replace("/", "_").replace(":", "_")
    
    safe_range = range_key.replace("/", "_")
    return f"{safe_symbol}__{safe_range}.json"


class RawResponseCache:

    def __init__(self, cache_dir: str):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _path(self, symbol: str, range_key: str) -> Path:
        return self.cache_dir / _cache_key(symbol, range_key)

    def get(self, symbol: str, range_key: str) -> dict | None:
        path = self._path(symbol, range_key)
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def set(self, symbol: str, range_key: str, raw_response: dict) -> None:
        path = self._path(symbol, range_key)
        tmp_path = path.with_suffix(".json.tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(raw_response, f)
        os.replace(tmp_path, path)  
