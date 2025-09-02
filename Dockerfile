FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Copy source files and config first
COPY tsconfig.json ./
COPY src ./src
# Don't copy OAuth keys into the image - they should be provided at runtime

# Install dependencies (which will trigger build via prepare script)
RUN npm ci

# Create directory for credentials and config
RUN mkdir -p /gmail-server /root/.gmail-mcp

# Set environment variables for HTTP mode (required for Smithery)
ENV NODE_ENV=production
ENV GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json
ENV PORT=3000
ENV USE_HTTP=true

# Expose port for MCP HTTP server
EXPOSE 3000

# Add health check to verify service is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/mcp || exit 1

# Install curl for health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Set entrypoint command
ENTRYPOINT ["node", "dist/index.js"]