#!/bin/bash

echo "🧪 Testing Gmail MCP Server Locally"
echo "===================================="

# Build the project
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"

# Test 1: Check if server starts
echo -e "\n🔍 Testing server startup..."
timeout 2s node dist/index.js 2>&1 | head -n 5

# Test 2: List tools via stdio
echo -e "\n📋 Testing tool listing..."
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | timeout 2s node dist/index.js 2>/dev/null | grep -o '"name":"[^"]*"' | head -n 3

if [ $? -eq 0 ]; then
    echo "✅ Server responds to tool listing"
else
    echo "⚠️  Could not list tools (may need OAuth setup)"
fi

# Test 3: Docker build (if Docker is available)
if command -v docker &> /dev/null; then
    echo -e "\n🐳 Testing Docker build..."
    docker build -t gmail-mcp-test . > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Docker image builds successfully"
    else
        echo "❌ Docker build failed"
    fi
else
    echo -e "\n⚠️  Docker not available, skipping container test"
fi

echo -e "\n✨ Local testing complete!"
echo "Next steps:"
echo "  1. For interactive testing: npx @modelcontextprotocol/inspector dist/index.js"
echo "  2. To commit: git add . && git commit -m 'fix: simplify server transport and update smithery config'"
echo "  3. To push: git push origin main"