FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy built distribution
COPY dist/ ./dist/

# Set environment
ENV NODE_ENV=production

# Expose the port (Smithery will set the PORT environment variable)
EXPOSE 8080

# Start the MCP server
CMD ["node", "dist/index.js"]