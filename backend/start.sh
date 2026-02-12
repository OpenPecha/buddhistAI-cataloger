#!/bin/bash
set -e

echo "Installing dependencies with Poetry..."
poetry install

echo "Running database migrations..."
poetry run alembic upgrade head

echo "Starting application..."
poetry run uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --reload
