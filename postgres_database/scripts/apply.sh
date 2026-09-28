#!/usr/bin/env bash

set -euo pipefail

# Load .env if present
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi


# Database connection
DATABASE="${TARGET_DATABASE:-${POSTGRES_DB:-}}"


if [ -z "$DATABASE" ]; then
    echo "ERROR: TARGET_DATABASE or POSTGRES_DB is not set"
    exit 1
fi


echo "Using database: $DATABASE"


# Apply migrations
echo "Applying migrations..."

for migration in migrations/*.sql
do
    echo "Applying: $migration"

    psql "$DATABASE" \
        -v ON_ERROR_STOP=1 \
        -f "$migration"
done


# Load seed data
echo "Loading seed data..."

for seed_file in seed/*.sql
do
    echo "Loading: $seed_file"

    psql "$DATABASE" \
        -v ON_ERROR_STOP=1 \
        -f "$seed_file"
done

echo "Running analytical queries..."

for query_file in queries/*.sql
do
    echo "===================================="
    echo "Executing: $query_file"
    echo "===================================="

    psql "$DATABASE" \
        -v ON_ERROR_STOP=1 \
        -a \
        -f "$query_file"

    echo ""
done





echo "Database setup completed successfully."