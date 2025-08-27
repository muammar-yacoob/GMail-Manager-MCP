FROM node:18-alpine

WORKDIR /app

# Copy package files and TypeScript config
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev deps for TypeScript)
RUN npm ci

# Copy source files for Smithery CLI build
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Start the MCP server
CMD ["node", "dist/index.js"]