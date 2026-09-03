# postgres_etl — ETL pipeline for the operational Postgres database.
#
# Extracts orders + transactions from Postgres and loads them into
# trades.duckdb (a dedicated DuckDB file, completely separate from
# analytics.duckdb used by the Fauxnance candle pipeline).
