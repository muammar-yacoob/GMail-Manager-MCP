FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Copy source files and config first
COPY tsconfig.json ./
COPY src ./src
COPY gcp-oauth.keys.json* ./

# Install dependencies (which will trigger build via prepare script)
RUN npm ci

# Create directory for credentials and config
RUN mkdir -p /gmail-server /root/.gmail-mcp

# Copy dummy OAuth file if it exists
RUN if [ -f gcp-oauth.keys.json ]; then cp gcp-oauth.keys.json /root/.gmail-mcp/; fi

# Set environment variables
ENV NODE_ENV=production
ENV GMAIL_CREDENTIALS_PATH=/gmail-server/credentials.json
# Only set GMAIL_OAUTH_PATH if file exists, otherwise let server start without credentials

# Expose port for OAuth flow
EXPOSE 3000

# Set entrypoint command
ENTRYPOINT ["node", "dist/index.js"]