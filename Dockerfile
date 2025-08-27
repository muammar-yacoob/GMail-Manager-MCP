FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built distribution
COPY dist/ ./dist/

# Start the MCP server
CMD ["node", "dist/index.js"]