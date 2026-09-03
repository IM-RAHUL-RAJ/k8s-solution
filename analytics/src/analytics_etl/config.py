# ---------------------------------------------------------------------------
# SYMBOL_UNIVERSE
# Keys   : Fauxnance API symbol strings used as pipeline inputs.
# Values : Human-readable display names used in charts and dashboards.
#
# This is the single source of truth for instrument names.
# Do NOT add a local COMPANY_NAMES dict in any analysis module — import this.
# ---------------------------------------------------------------------------
SYMBOL_UNIVERSE: dict[str, str] = {
    "INFY.NS":     "Infosys Limited (INFY.NS)",
    "RELIANCE.NS": "Reliance Industries Limited (RELIANCE.NS)",
    "AAPL":        "Apple Inc. (AAPL)",
    "HCLTECH.BO":  "Hindustan Computers Limited (HCLTECH.BO)",
    "FX:EURUSD":   "FOREX Euro -> USD (FX:EURUSD)",
}

# Convenience alias — analysis modules import COMPANY_NAMES from here.
COMPANY_NAMES: dict[str, str] = SYMBOL_UNIVERSE

CACHE_DIR  = "data/cache"
STORE_PATH = "data/analytics.duckdb"
