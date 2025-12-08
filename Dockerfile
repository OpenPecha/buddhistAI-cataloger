# Base image
FROM python:3.11-slim as base

# Set working directory
WORKDIR /app

# Backend stage
FROM base as backend-stage
COPY backend/requirements.txt ./backend/
RUN apt-get update && apt-get install -y git
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/

# Final image
FROM backend-stage

EXPOSE 8000

# Start backend services
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
