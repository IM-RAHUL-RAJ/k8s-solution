#!/usr/bin/env bash

set -uo pipefail


# LOAD ENVIRONMENT

if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi



# DATABASE SELECTION

DATABASE="${TARGET_DATABASE:-${POSTGRES_DB:-}}"


if [ -z "$DATABASE" ]; then
    echo "ERROR: TARGET_DATABASE or POSTGRES_DB is not set"
    exit 1
fi


echo "============================================================"
echo "Running database probes"
echo "Using database: $DATABASE"
echo "============================================================"
echo



# CHECK PROBE DIRECTORY

if [ ! -d "probes" ]; then
    echo "ERROR: probes directory does not exist"
    exit 1
fi



# EXECUTE PROBES

for probe in probes/*.sql
do

    if [ ! -f "$probe" ]; then
        continue
    fi


    echo "------------------------------------------------------------"
    echo "Running probe: $probe"
    echo "------------------------------------------------------------"


    OUTPUT=$(psql "$DATABASE" \
        -v ON_ERROR_STOP=1 \
        -f "$probe" 2>&1)

    EXIT_CODE=$?


    echo "$OUTPUT"


    echo


    if [ "$EXIT_CODE" -eq 0 ]; then

        echo "RESULT: PASS"
        echo "No database error detected"

    else

        echo "RESULT: EXPECTED FAILURE"

        # Extract SQLSTATE if available
        SQLSTATE=$(echo "$OUTPUT" |
            grep -oE 'SQLSTATE [0-9A-Z]+' |
            awk '{print $2}' |
            head -n 1 || true)


        # Fallback detection
        if [ -z "$SQLSTATE" ]; then

            if echo "$OUTPUT" | grep -qi "duplicate key"; then
                SQLSTATE="23505"
            fi


            if echo "$OUTPUT" | grep -qi "foreign key constraint"; then
                SQLSTATE="23503"
            fi

        fi


        if [ -n "$SQLSTATE" ]; then
            echo "SQLSTATE: $SQLSTATE"
        else
            echo "SQLSTATE: UNKNOWN"
        fi

    fi


    echo

done


echo "============================================================"
echo "All probes completed"
echo "============================================================"
