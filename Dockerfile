# Base image
FROM python:3.11-slim

# Install Node.js and npm
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Backend setup
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/

# Frontend setup
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm install --prefix ./frontend
COPY frontend/ ./frontend/
RUN npm run build --prefix ./frontend

# Expose ports
EXPOSE 8000 10000

# Start both services
CMD ["/bin/bash", "-c", "cd backend && uvicorn main:app --host 0.0.0.0 --port 8000 & cd ../frontend && npm run preview"]
