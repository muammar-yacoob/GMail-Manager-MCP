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

# Check for OAuth keys
oauth_keys_found=false
if [ -n "$GMAIL_OAUTH_PATH" ]; then
    if [ -f "$GMAIL_OAUTH_PATH" ]; then
        echo "✅ OAuth keys file found at: $GMAIL_OAUTH_PATH"
        oauth_keys_found=true
    else
        log_error "OAuth keys file not found at specified path" "$GMAIL_OAUTH_PATH"
    fi
elif [ -f "gcp-oauth.keys.json" ]; then
    echo "✅ OAuth keys file found in project root: gcp-oauth.keys.json"
    oauth_keys_found=true
elif [ -f ~/.gmail-mcp/gcp-oauth.keys.json ]; then
    echo "✅ OAuth keys file found at: ~/.gmail-mcp/gcp-oauth.keys.json"
    oauth_keys_found=true
else
    echo "⚠️  No OAuth keys file found"
fi

# Test credential validation if OAuth keys are available
if [ "$oauth_keys_found" = true ]; then
    echo "   Testing credential validation..."
    
    if [ -f ~/.gmail-mcp/credentials.json ]; then
        echo "   ✅ Found saved credentials in ~/.gmail-mcp/"
        
        # Test debug-auth script
        debug_output=$(GMAIL_OAUTH_PATH="$GMAIL_OAUTH_PATH" npm run debug-auth 2>&1)
        debug_exit_code=$?
        
        if [ $debug_exit_code -eq 0 ]; then
            if echo "$debug_output" | grep -q "Has credentials: true"; then
                echo "   ✅ Authentication credentials are valid"
            else
                echo "   ⚠️  Credentials may be expired or invalid"
                echo "$debug_output" | grep -E "(Has credentials|Error)" | sed 's/^/      /'
            fi
        else
            log_error "Debug auth script failed" "$debug_output"
        fi
    else
        echo "   ⚠️  No saved credentials found"
        echo "      Authentication required (run: npm run auth)"
    fi
else
    echo "   ❌ Cannot test credentials without OAuth keys"
    echo "   💡 Setup steps:"
    echo "      1. Download gcp-oauth.keys.json from Google Cloud Console"
    echo "      2. Place it in project root or set GMAIL_OAUTH_PATH"
    echo "      3. Run: npm run auth"
fi

# Test 4: Docker build (if Docker is available)
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
