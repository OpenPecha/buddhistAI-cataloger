# Cataloger Backend

FastAPI backend for managing OpenPecha texts and persons.

## Setup

### Prerequisites

- Python 3.12+
- Poetry (install via `pip install poetry` or follow [official instructions](https://python-poetry.org/docs/#installation))

### Installation

1. Install dependencies:
```bash
poetry install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run database migrations:
```bash
poetry run alembic upgrade head
```

4. Start the development server:
```bash
poetry run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Or use the convenience script:
```bash
chmod +x start.sh
./start.sh
```

## Development

- Run migrations: `poetry run alembic upgrade head`
- Create migration: `poetry run alembic revision --autogenerate -m "description"`
- Run tests: `poetry run pytest` (if configured)

## Docker

The Dockerfile uses Poetry for dependency management. Build and run:

```bash
docker build -t cataloger-backend .
docker run -p 8000:8000 cataloger-backend
```
