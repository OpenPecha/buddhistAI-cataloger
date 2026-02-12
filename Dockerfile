# Base image
FROM python:3.12 as base

# Set working directory
WORKDIR /app

# Backend stage
FROM base as backend-stage
COPY backend/requirements.txt ./backend/
RUN apt-get update && apt-get install -y git
RUN pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir --no-build-isolation -r backend/requirements.txt
COPY backend/ ./backend/
RUN chmod +x ./backend/entrypoint.sh

# Final image
FROM backend-stage

EXPOSE 8000

# Set entrypoint
ENTRYPOINT ["/bin/bash", "/app/backend/entrypoint.sh"]

# Start backend services
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
