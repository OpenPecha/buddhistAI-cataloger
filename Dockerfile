# Base image
FROM python:3.12 as backend-stage

WORKDIR /app/backend

# OS deps
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (cache-friendly)
COPY backend/requirements.txt .

# Upgrade pip and install setuptools with pkg_resources (required by pyewts)
RUN python -m pip install --upgrade pip && \
    pip install "setuptools<81" wheel

# Install pyewts first with --no-build-isolation to use system setuptools
RUN pip install --no-build-isolation pyewts

# Install remaining deps
RUN pip install -r requirements.txt

# Copy code
COPY backend/ .
RUN chmod +x ./entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/bin/bash", "/app/backend/entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
