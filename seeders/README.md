# Seeders

Development seeders for populating the cataloger with fake data.

## Outliner Seeder

Seeds the outliner with ~30 fake documents (Tibetan Buddhist–style content) and segments for development.

### Prerequisites

- Python environment with backend dependencies installed
- `DATABASE_URL` set in `.env` (same as backend)
- Database migrations applied

### Run

From project root:

```bash
python seeders/outliner_seeder.py
```

Or with a custom count:

```bash
python seeders/outliner_seeder.py -n 50
```

### Options

| Option | Description |
|--------|-------------|
| `-n`, `--count` | Number of documents to create (default: 30) |
