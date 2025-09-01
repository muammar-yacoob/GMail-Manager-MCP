#!/bin/bash

# Gmail Manager MCP Installer
# Cross-platform installer for Gmail Manager MCP Server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}================================${NC}"
    echo -e "${PURPLE}  Gmail Manager MCP Installer${NC}"
    echo -e "${PURPLE}================================${NC}"
    echo
}

# Function to detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)     OS="linux";;
        Darwin*)    OS="macos";;
        CYGWIN*|MINGW*|MSYS*) OS="windows";;
        *)          OS="unknown";;
    esac
    print_status "Detected OS: $OS"
}

# Function to check if Node.js is installed
check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
        return 0
    else
        print_error "Node.js is not installed. Please install Node.js first."
        print_status "Visit: https://nodejs.org/"
        return 1
    fi
}

# Function to check if npm is installed
check_npm() {
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm found: $NPM_VERSION"
        return 0
    else
        print_error "npm is not installed. Please install npm first."
        return 1
    fi
}

# Function to get Claude Desktop config path
get_claude_config_path() {
    case "$OS" in
        "windows")
            CONFIG_PATH="$APPDATA/Claude/claude_desktop_config.json"
            ;;
        "macos")
            CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
            ;;
        "linux")
            CONFIG_PATH="$HOME/.config/Claude/claude_desktop_config.json"
            ;;
        *)
            print_error "Unsupported OS: $OS"
            exit 1
            ;;
    esac
    print_status "Claude Desktop config path: $CONFIG_PATH"
}

# Function to create backup of existing config
backup_config() {
    if [ -f "$CONFIG_PATH" ]; then
        BACKUP_PATH="${CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$CONFIG_PATH" "$BACKUP_PATH"
        print_success "Backup created: $BACKUP_PATH"
    fi
}

# Function to read existing config
read_config() {
    if [ -f "$CONFIG_PATH" ]; then
        CONFIG_CONTENT=$(cat "$CONFIG_PATH")
    else
        CONFIG_CONTENT="{}"
    fi
}

# Function to update config with Gmail Manager MCP
update_config() {
    # Check if gmail-manager already exists in config
    if echo "$CONFIG_CONTENT" | grep -q '"gmail-manager"'; then
        print_warning "Gmail Manager MCP is already configured in Claude Desktop"
        read -p "Do you want to update the existing configuration? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_status "Skipping config update"
            return 0
        fi
    fi

    # Create config directory if it doesn't exist
    CONFIG_DIR=$(dirname "$CONFIG_PATH")
    mkdir -p "$CONFIG_DIR"

    # Update config using jq if available, otherwise use sed
    if command -v jq &> /dev/null; then
        # Use jq for proper JSON handling
        if [ "$CONFIG_CONTENT" = "{}" ]; then
            # Empty config, create new one
            echo '{
  "mcpServers": {
    "gmail-manager": {
      "command": "npx",
      "args": ["@spark-apps/gmail-manager-mcp"]
    }
  }
}' > "$CONFIG_PATH"
        else
            # Update existing config
            echo "$CONFIG_CONTENT" | jq '.mcpServers["gmail-manager"] = {"command": "npx", "args": ["@spark-apps/gmail-manager-mcp"]}' > "$CONFIG_PATH"
        fi
    else
        # Fallback to sed (less reliable but works)
        if [ "$CONFIG_CONTENT" = "{}" ]; then
            echo '{
  "mcpServers": {
    "gmail-manager": {
      "command": "npx",
      "args": ["@spark-apps/gmail-manager-mcp"]
    }
  }
}' > "$CONFIG_PATH"
        else
            # Try to update existing config with sed
            if echo "$CONFIG_CONTENT" | grep -q '"mcpServers"'; then
                # Config has mcpServers, add gmail-manager
                sed -i.bak 's/"mcpServers": {/"mcpServers": {\n    "gmail-manager": {\n      "command": "npx",\n      "args": ["@spark-apps\/gmail-manager-mcp"]\n    },/' "$CONFIG_PATH"
            else
                # Config doesn't have mcpServers, add it
                sed -i.bak 's/}$/,\n  "mcpServers": {\n    "gmail-manager": {\n      "command": "npx",\n      "args": ["@spark-apps\/gmail-manager-mcp"]\n    }\n  }\n}/' "$CONFIG_PATH"
            fi
        fi
    fi

    print_success "Claude Desktop config updated successfully"
}

# Function to check for OAuth credentials
check_oauth_credentials() {
    print_status "Checking for OAuth credentials..."
    
    # Check for gcp-oauth.keys.json in current directory
    if [ -f "gcp-oauth.keys.json" ]; then
        print_success "Found gcp-oauth.keys.json in current directory"
        return 0
    fi
    
    # Check for gcp-oauth.keys.json in home directory
    if [ -f "$HOME/gcp-oauth.keys.json" ]; then
        print_success "Found gcp-oauth.keys.json in home directory"
        return 0
    fi
    
    # Check for GMAIL_OAUTH_PATH environment variable
    if [ -n "$GMAIL_OAUTH_PATH" ] && [ -f "$GMAIL_OAUTH_PATH" ]; then
        print_success "Found OAuth credentials at: $GMAIL_OAUTH_PATH"
        return 0
    fi
    
    print_warning "No OAuth credentials found"
    return 1
}

# Function to provide OAuth setup instructions
show_oauth_instructions() {
    echo
    print_status "OAuth Setup Required"
    echo
    echo "To use Gmail Manager MCP, you need to set up OAuth credentials:"
    echo
    echo "1. Create Google Cloud Project"
    echo "   Visit: https://console.cloud.google.com/projectcreate"
    echo
    echo "2. Enable Gmail API"
    echo "   Visit: https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics"
    echo
    echo "3. Create OAuth Credentials"
    echo "   Visit: https://console.cloud.google.com/auth/clients"
    echo "   Choose 'Desktop app' type"
    echo "   Download as gcp-oauth.keys.json"
    echo
    echo "4. Add Required Scopes"
    echo "   Visit: https://console.cloud.google.com/auth/scopes"
    echo "   Add: https://www.googleapis.com/auth/gmail.modify"
    echo "   Add: https://www.googleapis.com/auth/gmail.settings.basic"
    echo
    echo "5. Add Test User"
    echo "   Visit: https://console.cloud.google.com/auth/audience"
    echo "   Add your Google email as test user"
    echo
    echo "6. Place the gcp-oauth.keys.json file in one of these locations:"
    echo "   - Current directory (where you ran this installer)"
    echo "   - Your home directory ($HOME)"
    echo "   - Set GMAIL_OAUTH_PATH environment variable"
    echo
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    if [ -f "package.json" ]; then
        # Local development setup
        print_status "Detected local development setup"
        npm install
        npm run build
        print_success "Dependencies installed and project built"
    else
        # NPM package setup
        print_status "Using NPM package setup"
        npm install -g @spark-apps/gmail-manager-mcp
        print_success "Gmail Manager MCP installed globally"
    fi
}

# Function to test installation
test_installation() {
    print_status "Testing installation..."
    
    if command -v npx &> /dev/null; then
        # Test if the package can be executed
        if npx @spark-apps/gmail-manager-mcp --help &> /dev/null || npx @spark-apps/gmail-manager-mcp auth &> /dev/null; then
            print_success "Installation test passed"
            return 0
        fi
    fi
    
    print_warning "Could not test installation automatically"
    return 0
}

# Function to show completion message
show_completion_message() {
    echo
    print_success "Installation completed successfully!"
    echo
    echo "Next steps:"
    echo "1. Restart Claude Desktop completely"
    echo "2. Try any Gmail command - authentication will happen automatically"
    echo "3. Grant permissions when your browser opens"
    echo
    echo "If you haven't set up OAuth credentials yet, please follow the instructions above."
    echo
    echo "For help and support, visit: https://github.com/muammar-yacoob/GMail-Manager-MCP"
    echo
}

# Main installation function
main() {
    print_header
    
    # Detect OS
    detect_os
    
    # Check prerequisites
    print_status "Checking prerequisites..."
    if ! check_nodejs; then
        exit 1
    fi
    
    if ! check_npm; then
        exit 1
    fi
    
    # Get Claude Desktop config path
    get_claude_config_path
    
    # Check for OAuth credentials
    if ! check_oauth_credentials; then
        show_oauth_instructions
    fi
    
    # Install dependencies
    install_dependencies
    
    # Backup and update config
    print_status "Updating Claude Desktop configuration..."
    backup_config
    read_config
    update_config
    
    # Test installation
    test_installation
    
    # Show completion message
    show_completion_message
}

# Run main function
main "$@"
