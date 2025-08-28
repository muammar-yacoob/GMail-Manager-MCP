FROM node:20-slim

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

# OAuth keys should be provided via environment variables at runtime, not in the image

# Set environment variables
ENV NODE_ENV=production
ENV GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json
ENV PORT=3000
# OAuth keys should be provided via environment variables at runtime

# Expose port for MCP HTTP server
EXPOSE 3000

# Set entrypoint command
ENTRYPOINT ["node", "dist/index.js"]