# Cataloger Backend

FastAPI backend for managing OpenPecha texts and persons.

## Setup

### Prerequisites

- Python 3.11+

### Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run database migrations:
```bash
alembic upgrade head
```

4. Start the development server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Or use the convenience script:
```bash
chmod +x start.sh
./start.sh
```

## Development

- Run migrations: `alembic upgrade head`
- Create migration: `alembic revision --autogenerate -m "description"`
- Run tests: `pytest` (if configured)

## Docker

Build and run:

```bash
docker build -t cataloger-backend .
docker run -p 8000:8000 cataloger-backend
```
