# Gmail Manager MCP Installer for Windows PowerShell
# Cross-platform installer for Gmail Manager MCP Server

param(
    [switch]$Help
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"
$Purple = "Magenta"
$Cyan = "Cyan"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Red
}

function Write-Header {
    Write-Host "=================================" -ForegroundColor $Purple
    Write-Host "  Gmail Manager MCP Installer" -ForegroundColor $Purple
    Write-Host "=================================" -ForegroundColor $Purple
    Write-Host ""
}

# Function to check if Node.js is installed
function Test-NodeJS {
    try {
        $nodeVersion = node --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Node.js found: $nodeVersion"
            return $true
        }
    }
    catch {
        Write-Error "Node.js is not installed. Please install Node.js first."
        Write-Status "Visit: https://nodejs.org/"
        return $false
    }
    return $false
}

# Function to check if npm is installed
function Test-NPM {
    try {
        $npmVersion = npm --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "npm found: $npmVersion"
            return $true
        }
    }
    catch {
        Write-Error "npm is not installed. Please install npm first."
        return $false
    }
    return $false
}

# Function to get Claude Desktop config path
function Get-ClaudeConfigPath {
    $configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
    Write-Status "Claude Desktop config path: $configPath"
    return $configPath
}

# Function to create backup of existing config
function Backup-Config {
    param([string]$ConfigPath)
    
    if (Test-Path $ConfigPath) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = "$ConfigPath.backup.$timestamp"
        Copy-Item $ConfigPath $backupPath
        Write-Success "Backup created: $backupPath"
    }
}

# Function to read existing config
function Read-Config {
    param([string]$ConfigPath)
    
    if (Test-Path $ConfigPath) {
        return Get-Content $ConfigPath -Raw
    }
    return "{}"
}

# Function to update config with Gmail Manager MCP
function Update-Config {
    param([string]$ConfigPath, [string]$ConfigContent)
    
    # Check if gmail-manager already exists in config
    if ($ConfigContent -match '"gmail-manager"') {
        Write-Warning "Gmail Manager MCP is already configured in Claude Desktop"
        $response = Read-Host "Do you want to update the existing configuration? (y/N)"
        if ($response -notmatch "^[Yy]$") {
            Write-Status "Skipping config update"
            return
        }
    }
    
    # Create config directory if it doesn't exist
    $configDir = Split-Path $ConfigPath -Parent
    if (!(Test-Path $configDir)) {
        New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    }
    
    # Create new config with Gmail Manager MCP
    $newConfig = @"
{
  "mcpServers": {
    "gmail-manager": {
      "command": "npx",
      "args": ["@spark-apps/gmail-manager-mcp"]
    }
  }
}
"@
    
    $newConfig | Out-File -FilePath $ConfigPath -Encoding UTF8
    Write-Success "Claude Desktop config updated successfully"
}

# Function to check for OAuth credentials
function Test-OAuthCredentials {
    Write-Status "Checking for OAuth credentials..."
    
    # Check for gcp-oauth.keys.json in current directory
    if (Test-Path "gcp-oauth.keys.json") {
        Write-Success "Found gcp-oauth.keys.json in current directory"
        return $true
    }
    
    # Check for gcp-oauth.keys.json in home directory
    if (Test-Path "$env:USERPROFILE\gcp-oauth.keys.json") {
        Write-Success "Found gcp-oauth.keys.json in home directory"
        return $true
    }
    
    # Check for GMAIL_OAUTH_PATH environment variable
    if ($env:GMAIL_OAUTH_PATH -and (Test-Path $env:GMAIL_OAUTH_PATH)) {
        Write-Success "Found OAuth credentials at: $env:GMAIL_OAUTH_PATH"
        return $true
    }
    
    Write-Warning "No OAuth credentials found"
    return $false
}

# Function to provide OAuth setup instructions
function Show-OAuthInstructions {
    Write-Host ""
    Write-Status "OAuth Setup Required"
    Write-Host ""
    Write-Host "To use Gmail Manager MCP, you need to set up OAuth credentials:"
    Write-Host ""
    Write-Host "1. Create Google Cloud Project"
    Write-Host "   Visit: https://console.cloud.google.com/projectcreate"
    Write-Host ""
    Write-Host "2. Enable Gmail API"
    Write-Host "   Visit: https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics"
    Write-Host ""
    Write-Host "3. Create OAuth Credentials"
    Write-Host "   Visit: https://console.cloud.google.com/auth/clients"
    Write-Host "   Choose 'Desktop app' type"
    Write-Host "   Download as gcp-oauth.keys.json"
    Write-Host ""
    Write-Host "4. Add Required Scopes"
    Write-Host "   Visit: https://console.cloud.google.com/auth/scopes"
    Write-Host "   Add: https://www.googleapis.com/auth/gmail.modify"
    Write-Host "   Add: https://www.googleapis.com/auth/gmail.settings.basic"
    Write-Host ""
    Write-Host "5. Add Test User"
    Write-Host "   Visit: https://console.cloud.google.com/auth/audience"
    Write-Host "   Add your Google email as test user"
    Write-Host ""
    Write-Host "6. Place the gcp-oauth.keys.json file in one of these locations:"
    Write-Host "   - Current directory (where you ran this installer)"
    Write-Host "   - Your home directory ($env:USERPROFILE)"
    Write-Host "   - Set GMAIL_OAUTH_PATH environment variable"
    Write-Host ""
}

# Function to install dependencies
function Install-Dependencies {
    Write-Status "Installing dependencies..."
    
    if (Test-Path "package.json") {
        # Local development setup
        Write-Status "Detected local development setup"
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install dependencies"
            exit 1
        }
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to build project"
            exit 1
        }
        Write-Success "Dependencies installed and project built"
    }
    else {
        # NPM package setup
        Write-Status "Using NPM package setup"
        npm install -g @spark-apps/gmail-manager-mcp
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to install Gmail Manager MCP"
            exit 1
        }
        Write-Success "Gmail Manager MCP installed globally"
    }
}

# Function to test installation
function Test-Installation {
    Write-Status "Testing installation..."
    
    try {
        npx @spark-apps/gmail-manager-mcp --help 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Installation test passed"
            return
        }
    }
    catch {
        # Try alternative test
        try {
            npx @spark-apps/gmail-manager-mcp auth 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Installation test passed"
                return
            }
        }
        catch {
            Write-Warning "Could not test installation automatically"
        }
    }
}

# Function to show completion message
function Show-CompletionMessage {
    Write-Host ""
    Write-Success "Installation completed successfully!"
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Restart Claude Desktop completely"
    Write-Host "2. Try any Gmail command - authentication will happen automatically"
    Write-Host "3. Grant permissions when your browser opens"
    Write-Host ""
    
    if (-not (Test-OAuthCredentials)) {
        Write-Host "If you haven't set up OAuth credentials yet, please follow the instructions above."
        Write-Host ""
    }
    
    Write-Host "For help and support, visit: https://github.com/muammar-yacoob/GMail-Manager-MCP"
    Write-Host ""
}

# Main installation function
function Main {
    Write-Header
    
    # Check prerequisites
    Write-Status "Checking prerequisites..."
    if (-not (Test-NodeJS)) {
        exit 1
    }
    
    if (-not (Test-NPM)) {
        exit 1
    }
    
    # Get Claude Desktop config path
    $configPath = Get-ClaudeConfigPath
    
    # Check for OAuth credentials
    if (-not (Test-OAuthCredentials)) {
        Show-OAuthInstructions
    }
    
    # Install dependencies
    Install-Dependencies
    
    # Backup and update config
    Write-Status "Updating Claude Desktop configuration..."
    Backup-Config $configPath
    $configContent = Read-Config $configPath
    Update-Config $configPath $configContent
    
    # Test installation
    Test-Installation
    
    # Show completion message
    Show-CompletionMessage
}

# Show help if requested
if ($Help) {
    Write-Header
    Write-Host "Gmail Manager MCP Installer for Windows PowerShell"
    Write-Host ""
    Write-Host "Usage: .\setup.ps1 [-Help]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Help    Show this help message"
    Write-Host ""
    Write-Host "This installer will:"
    Write-Host "- Check for Node.js and npm"
    Write-Host "- Install Gmail Manager MCP dependencies"
    Write-Host "- Automatically configure Claude Desktop"
    Write-Host "- Back up existing MCP configurations"
    Write-Host "- Check for OAuth credentials"
    Write-Host "- Provide setup instructions if needed"
    Write-Host ""
    exit 0
}

# Run main function
Main
