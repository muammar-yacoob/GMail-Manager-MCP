#!/bin/bash

# Error logging function
log_error() {
    echo "❌ ERROR: $1" >&2
    if [ -n "$2" ]; then
        echo "   Details: $2" >&2
    fi
}

# Function to capture and log command output/errors
run_with_logging() {
    local description="$1"
    local command="$2"
    local temp_output=$(mktemp)
    local temp_error=$(mktemp)
    
    echo "$description"
    
    if eval "$command" > "$temp_output" 2> "$temp_error"; then
        local output=$(cat "$temp_output")
        if [ -n "$output" ]; then
            echo "$output"
        fi
        rm -f "$temp_output" "$temp_error"
        return 0
    else
        local exit_code=$?
        local error_output=$(cat "$temp_error")
        local stdout_output=$(cat "$temp_output")
        
        log_error "$description failed (exit code: $exit_code)" "$error_output"
        if [ -n "$stdout_output" ]; then
            echo "   Stdout: $stdout_output" >&2
        fi
        
        rm -f "$temp_output" "$temp_error"
        return $exit_code
    fi
}

echo "🧪 Testing Gmail MCP Server Locally"
echo "===================================="

# Build the project
if ! run_with_logging "📦 Building project..." "npm run build"; then
    echo "❌ Build failed - cannot continue with tests"
    exit 1
fi

echo "✅ Build successful"

# Test 1: Check if server starts
echo -e "\n🔍 Testing server startup..."
startup_output=$(timeout 2s node dist/index.js 2>&1)
startup_exit_code=$?

if [ $startup_exit_code -eq 124 ]; then
    # Timeout is expected for MCP servers in stdio mode
    echo "✅ Server started (timeout expected for stdio mode)"
    echo "$startup_output" | head -n 3 | sed 's/^/   /'
elif [ $startup_exit_code -ne 0 ]; then
    log_error "Server startup failed" "$startup_output"
else
    echo "✅ Server started and exited cleanly"
    echo "$startup_output" | head -n 3 | sed 's/^/   /'
fi

# Test 2: List tools via stdio
echo -e "\n📋 Testing tool listing..."
tools_output=$(echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | timeout 2s node dist/index.js 2>/dev/null)
tools_exit_code=$?

if [ $tools_exit_code -eq 0 ] && echo "$tools_output" | grep -q '"name"'; then
    echo "✅ Server responds to tool listing"
    echo "$tools_output" | grep -o '"name":"[^"]*"' | head -n 3 | sed 's/^/   Found tool: /'
elif [ $tools_exit_code -eq 124 ]; then
    echo "⚠️  Tool listing timed out (may indicate server is waiting for proper MCP handshake)"
else
    log_error "Tool listing failed" "Exit code: $tools_exit_code, Output: $tools_output"
fi

# Test 3: Authentication setup check
echo -e "\n🔐 Testing authentication setup..."

# Create a test script to check auth status
cat > temp_auth_check.mjs << 'EOF'
import { checkAuthStatus } from './dist/auth.js';

async function checkAuth() {
    try {
        const status = await checkAuthStatus();
        console.log(JSON.stringify(status));
        process.exit(0);
    } catch (error) {
        console.error('Auth check failed:', error.message);
        process.exit(1);
    }
}

checkAuth();
EOF

# Run the auth status check
auth_status_output=$(node temp_auth_check.mjs 2>&1)
auth_status_exit=$?

if [ $auth_status_exit -eq 0 ]; then
    # Parse the JSON output
    has_oauth=$(echo "$auth_status_output" | grep -o '"hasOAuthKeys":[^,}]*' | cut -d':' -f2)
    has_creds=$(echo "$auth_status_output" | grep -o '"hasCredentials":[^,}]*' | cut -d':' -f2)
    creds_valid=$(echo "$auth_status_output" | grep -o '"credentialsValid":[^,}]*' | cut -d':' -f2)
    
    if [ "$has_oauth" = "true" ]; then
        echo "✅ OAuth keys file found"
    else
        echo "❌ OAuth keys file not found"
        echo "   💡 Setup steps:"
        echo "      1. Download gcp-oauth.keys.json from Google Cloud Console"
        echo "      2. Place it in project root or set GMAIL_OAUTH_PATH"
    fi
    
    if [ "$has_creds" = "true" ]; then
        echo "✅ Stored credentials found"
        
        if [ "$creds_valid" = "true" ]; then
            echo "✅ Credentials are valid and working"
        else
            echo "⚠️  Credentials found but appear to be expired or invalid"
            echo "   💡 Run: npm run auth"
        fi
    else
        if [ "$has_oauth" = "true" ]; then
            echo "⚠️  No stored credentials found"
            echo "   💡 Authentication required: npm run auth"
        fi
    fi
    
    # Overall status
    if [ "$has_oauth" = "true" ] && [ "$creds_valid" = "true" ]; then
        echo "🎉 Authentication is fully configured and working!"
    elif [ "$has_oauth" = "true" ] && [ "$has_creds" = "true" ]; then
        echo "⚠️  Authentication setup incomplete - credentials need refresh"
    elif [ "$has_oauth" = "true" ]; then
        echo "⚠️  Authentication setup incomplete - run: npm run auth"
    else
        echo "❌ Authentication not configured - OAuth keys missing"
    fi
else
    log_error "Authentication status check failed" "$auth_status_output"
fi

# Clean up temp file
rm -f temp_auth_check.mjs

# Test 4: Full MCP protocol handshake test
echo -e "\n🤝 Testing full MCP protocol handshake..."
mcp_init_response=$(echo '{"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"0.1.0"}},"jsonrpc":"2.0","id":0}' | timeout 1s node dist/index.js 2>/dev/null | head -1)
mcp_init_exit=$?

# For MCP servers, timeout is expected (they keep running), but we should get a response
if echo "$mcp_init_response" | grep -q '"protocolVersion"'; then
    echo "✅ Server responds correctly to MCP initialization"
    if echo "$mcp_init_response" | grep -q '"version":"1.0.9"'; then
        echo "   Server version: 1.0.9"
    fi
    if echo "$mcp_init_response" | grep -q '"name":"gmail-manager"'; then
        echo "   Server name: gmail-manager"
    fi
elif [ -n "$mcp_init_response" ]; then
    log_error "Invalid MCP response" "$mcp_init_response"
else
    echo "⚠️  No MCP response received (server may not be starting properly)"
fi

# Test 5: HTTP/SSE mode test (for Smithery)
echo -e "\n🌐 Testing HTTP/SSE mode (Smithery deployment)..."
# Start server in HTTP mode in background
USE_HTTP=true PORT=3456 timeout 3s node dist/index.js 2>/dev/null &
http_pid=$!
sleep 1

# Check if server is listening
if kill -0 $http_pid 2>/dev/null; then
    echo "✅ HTTP server started on port 3456"
    
    # Test HTTP endpoint
    if command -v curl &> /dev/null; then
        http_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3456/mcp 2>/dev/null || echo "000")
        if [ "$http_response" = "404" ] || [ "$http_response" = "200" ]; then
            echo "   ✅ HTTP endpoint responds (status: $http_response)"
        else
            echo "   ⚠️  HTTP endpoint not responding (status: $http_response)"
        fi
    else
        echo "   ⚠️  curl not available, skipping HTTP endpoint test"
    fi
    
    # Clean up
    kill $http_pid 2>/dev/null
    wait $http_pid 2>/dev/null
else
    echo "⚠️  HTTP server failed to start"
fi

# Test 6: Docker build (if Docker is available)
if command -v docker &> /dev/null; then
    echo -e "\n🐳 Testing Docker build..."
    
    docker_output=$(docker build -t gmail-mcp-test . 2>&1)
    docker_exit_code=$?
    
    if [ $docker_exit_code -eq 0 ]; then
        echo "✅ Docker image builds successfully"
    else
        log_error "Docker build failed" "$docker_output"
    fi
else
    echo -e "\n⚠️  Docker not available, skipping container test"
fi

echo -e "\n✨ Local testing complete!"
echo "Next steps:"
echo "  1. For interactive testing: npx @modelcontextprotocol/inspector dist/index.js"
echo "  2. Test with Claude Desktop after pushing to GitHub"
