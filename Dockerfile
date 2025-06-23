# syntax=docker/dockerfile:1

# Use Debian-based Node.js image for better compatibility with native modules
ARG NODE_VERSION=18.20.4
FROM node:${NODE_VERSION}-bullseye-slim

# Use production node environment by default
ENV NODE_ENV=production

# Install system dependencies required for @sap/hana-client and health checks
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libc6-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# Run the application
CMD ["node", "index.js"]
