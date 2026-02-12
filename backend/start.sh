#!/bin/bash
set -e

echo "Installing dependencies with pip..."
pip install -r requirements.txt

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --reload
