<h1 align="center">
  <br>
  <a href="https://buddhistai.tools/"><img src="https://raw.githubusercontent.com/WeBuddhist/visual-assets/refs/heads/main/logo/WB-logo-purple.png" alt="OpenPecha" width="150"></a>
  <br>
</h1>

<h1 align="center">buddhistAI-cataloger</h1>

<p align="center">
  |MIT| |Python| |TypeScript|
</p>

A Buddhist text cataloger application that integrates with BDRC (Buddhist Digital Resource Center) to manage, annotate, and organize Buddhist texts. Features AI-powered outliner and text analysis capabilities.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Directory Structure](#directory-structure)
- [Development](#development)
- [Docker](#docker)
- [Contributing](#contributing)
- [How to get help](#how-to-get-help)
- [Terms of use](#terms-of-use)

## Features

- **BDRC Integration** - Search and manage Buddhist texts from the Buddhist Digital Resource Center
- **AI-Powered Outliner** - Automatic generation of text outlines using AI
- **Text Cataloger** - Catalog and annotate Buddhist texts with rich metadata
- **User Management** - Role-based access control with multi-tenant support
- **Tibetan Tokenization** - Built-in support for Tibetan text processing using Botok
- **REST API** - Full FastAPI backend with RESTful endpoints

## Prerequisites

### Backend
- Python 3.11+
- PostgreSQL
- Redis

### Frontend
- Node.js >= 18
- npm or yarn

## Installation

```bash
# Clone the repository
git clone https://github.com/OpenPecha/buddhistAI-cataloger.git
cd buddhistAI-cataloger
```

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env
# Edit .env with your configuration
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

## Configuration

### Backend Environment Variables

Create a `.env` file in the `backend` directory with the following:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cataloger

# Redis
REDIS_URL=redis://localhost:6379

# Other settings...
```

### Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```bash
VITE_API_URL=http://localhost:8000
```

## Usage

### Running Backend

```bash
cd backend

# Run database migrations
alembic upgrade head

# Start development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Or use the convenience script
chmod +x start.sh
./start.sh
```

### Running Frontend

```bash
cd frontend
npm run dev
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build
```

## Directory Structure

```
buddhistAI-cataloger/
├── backend/
│   ├── alembic/              # Database migrations
│   ├── bdrc/                 # BDRC API integration
│   ├── cataloger/            # Main application modules
│   │   ├── controller/       # Business logic
│   │   ├── prompts/         # AI prompts
│   │   ├── routers/         # API endpoints
│   │   └── utils/           # Utility functions
│   ├── config_botok/        # Tibetan tokenizer config
│   ├── core/                # Core configuration
│   ├── outliner/            # AI outliner module
│   ├── settings/            # Multi-tenant settings
│   ├── user/                # User management
│   ├── main.py              # Application entry point
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── public/              # Static assets and fonts
│   ├── src/                 # React source code
│   ├── package.json         # Node dependencies
│   └── vite.config.ts       # Vite configuration
├── docker-compose.yml       # Docker Compose config
└── Dockerfile               # Backend Docker image
```

## Development

### Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Running Tests

```bash
cd backend
pytest
```

## Docker

### Build Backend Image

```bash
docker build -t cataloger-backend .
```

### Run Container

```bash
docker run -p 8000:8000 cataloger-backend
```

### Using Docker Compose

```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.prod.yml up
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](https://github.com/OpenPecha/.github/blob/main/CONTRIBUTING.md) for details.

## How to get help
* File an issue.
* Join our [discord](https://discord.com/invite/7GFpPFSTeA).

## Terms of use
buddhistAI-cataloger is licensed under the [MIT License](/LICENSE.md).