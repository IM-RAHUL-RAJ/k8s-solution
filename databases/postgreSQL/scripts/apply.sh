#!/usr/bin/env bash

set -euo pipefail

# Resolve paths relative to this script, so it works from any current directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DB_DIR/../.." && pwd)"
MIGRATIONS_DIR="$DB_DIR/migrations"
SEED_DIR="$DB_DIR/seed"
QUERIES_DIR="$DB_DIR/queries"

# Load KEY=VALUE entries from .env without word-splitting values (supports spaces and <> in values).
load_env_file() {
    local env_file="$1"
    local line key value
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%$'\r'}"
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        [[ "$line" != *"="* ]] && continue

        key="${line%%=*}"
        value="${line#*=}"

        # trim surrounding whitespace on key only
        key="${key#"${key%%[![:space:]]*}"}"
        key="${key%"${key##*[![:space:]]}"}"

        [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
        export "$key=$value"
    done < "$env_file"
}

# Load .env if present (prefer repo root, then current working directory).
if [ -f "$REPO_ROOT/.env" ]; then
    load_env_file "$REPO_ROOT/.env"
elif [ -f ".env" ]; then
    load_env_file ".env"
fi


# Database connection
DATABASE="${TARGET_DATABASE:-${POSTGRES_DB:-${DB_NAME:-}}}"
DB_HOST_VALUE="${DB_HOST:-localhost}"
DB_PORT_VALUE="${DB_PORT:-${POSTGRES_PORT:-5432}}"
DB_USER_VALUE="${DB_USER:-${POSTGRES_USER:-}}"
DB_PASSWORD_VALUE="${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}"


if [ -z "$DATABASE" ]; then
    echo "ERROR: TARGET_DATABASE, POSTGRES_DB, or DB_NAME is not set"
    exit 1
fi

if [ -z "$DB_USER_VALUE" ]; then
    echo "ERROR: DB_USER or POSTGRES_USER is not set"
    exit 1
fi

# Tell psql exactly which connection settings to use (avoid OS-user fallback).
export PGHOST="$DB_HOST_VALUE"
export PGPORT="$DB_PORT_VALUE"
export PGUSER="$DB_USER_VALUE"
export PGDATABASE="$DATABASE"
if [ -n "$DB_PASSWORD_VALUE" ]; then
    export PGPASSWORD="$DB_PASSWORD_VALUE"
fi


echo "Using database: $PGDATABASE"
echo "Using host: $PGHOST port: $PGPORT user: $PGUSER"


# Apply migrations
echo "Applying migrations..."

if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "ERROR: migrations directory does not exist: $MIGRATIONS_DIR"
    exit 1
fi

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
if [ "${#migrations[@]}" -eq 0 ]; then
    echo "ERROR: no migration SQL files found in $MIGRATIONS_DIR"
    exit 1
fi

for migration in "${migrations[@]}"; do
    echo "Applying: $migration"

    psql \
        -v ON_ERROR_STOP=1 \
        -f "$migration"
done


# Load seed data
echo "Loading seed data..."

if [ ! -d "$SEED_DIR" ]; then
    echo "ERROR: seed directory does not exist: $SEED_DIR"
    exit 1
fi

seeds=("$SEED_DIR"/*.sql)
if [ "${#seeds[@]}" -eq 0 ]; then
    echo "ERROR: no seed SQL files found in $SEED_DIR"
    exit 1
fi

for seed_file in "${seeds[@]}"; do
    echo "Loading: $seed_file"

    psql \
        -v ON_ERROR_STOP=1 \
        -f "$seed_file"
done

if [ -d "$QUERIES_DIR" ]; then
    queries=("$QUERIES_DIR"/*.sql)
    if [ "${#queries[@]}" -gt 0 ]; then
        echo "Running analytical queries..."
        for query_file in "${queries[@]}"; do
            echo "===================================="
            echo "Executing: $query_file"
            echo "===================================="

            psql \
                -v ON_ERROR_STOP=1 \
                -a \
                -f "$query_file"

            echo ""
        done
    fi
fi





echo "Database setup completed successfully."