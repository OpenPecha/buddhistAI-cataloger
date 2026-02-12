# Base image
FROM python:3.12 as base

# Set working directory
WORKDIR /app

# Backend stage
FROM base as backend-stage
RUN apt-get update && apt-get install -y git && \
    pip install --upgrade pip setuptools wheel && \
    pip install poetry
COPY backend/pyproject.toml backend/poetry.lock* ./backend/
WORKDIR /app/backend
RUN poetry config virtualenvs.create false && \
    poetry install --no-interaction --no-ansi --no-root
COPY backend/ ./backend/
RUN chmod +x ./backend/entrypoint.sh

# Final image
FROM backend-stage

EXPOSE 8000

# Set entrypoint
ENTRYPOINT ["/bin/bash", "/app/backend/entrypoint.sh"]

# Start backend services
CMD ["poetry", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
