from __future__ import annotations


class PostgresETLError(Exception):
    """Base class for all postgres_etl errors."""


class PostgresConnectionError(PostgresETLError):
    """Raised when a connection to Postgres cannot be established."""

    def __init__(self, message: str):
        super().__init__(f"Postgres connection failed: {message}")


class PostgresExtractError(PostgresETLError):
    """Raised when an extraction query against Postgres fails."""

    def __init__(self, message: str):
        super().__init__(f"Postgres extract failed: {message}")


class TransformError(PostgresETLError):
    """Raised when a row cannot be transformed and the batch must stop."""

    def __init__(self, row: dict, reason: str):
        self.row    = row
        self.reason = reason
        super().__init__(f"Transform failed: {reason} | row={row}")


class LoadError(PostgresETLError):
    """Raised when the DuckDB load step fails."""

    def __init__(self, message: str):
        super().__init__(f"DuckDB load failed: {message}")
