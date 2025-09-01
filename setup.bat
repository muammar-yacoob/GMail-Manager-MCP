@echo off
setlocal enabledelayedexpansion

REM Gmail Manager MCP Installer for Windows
REM Cross-platform installer for Gmail Manager MCP Server

echo ================================
echo   Gmail Manager MCP Installer
echo ================================
echo.

REM Check if Node.js is installed
echo [INFO] Checking prerequisites...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install Node.js first.
    echo [INFO] Visit: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [SUCCESS] Node.js found: %NODE_VERSION%

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm is not installed. Please install npm first.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [SUCCESS] npm found: %NPM_VERSION%

REM Get Claude Desktop config path
set CONFIG_PATH=%APPDATA%\Claude\claude_desktop_config.json
echo [INFO] Claude Desktop config path: %CONFIG_PATH%

REM Check for OAuth credentials
echo [INFO] Checking for OAuth credentials...

if exist "gcp-oauth.keys.json" (
    echo [SUCCESS] Found gcp-oauth.keys.json in current directory
    set OAUTH_FOUND=1
) else if exist "%USERPROFILE%\gcp-oauth.keys.json" (
    echo [SUCCESS] Found gcp-oauth.keys.json in home directory
    set OAUTH_FOUND=1
) else if defined GMAIL_OAUTH_PATH (
    if exist "%GMAIL_OAUTH_PATH%" (
        echo [SUCCESS] Found OAuth credentials at: %GMAIL_OAUTH_PATH%
        set OAUTH_FOUND=1
    ) else (
        echo [WARNING] GMAIL_OAUTH_PATH is set but file not found: %GMAIL_OAUTH_PATH%
        set OAUTH_FOUND=0
    )
) else (
    echo [WARNING] No OAuth credentials found
    set OAUTH_FOUND=0
)

if %OAUTH_FOUND%==0 (
    echo.
    echo [INFO] OAuth Setup Required
    echo.
    echo To use Gmail Manager MCP, you need to set up OAuth credentials:
    echo.
    echo 1. Create Google Cloud Project
    echo    Visit: https://console.cloud.google.com/projectcreate
    echo.
    echo 2. Enable Gmail API
    echo    Visit: https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics
    echo.
    echo 3. Create OAuth Credentials
    echo    Visit: https://console.cloud.google.com/auth/clients
    echo    Choose 'Desktop app' type
    echo    Download as gcp-oauth.keys.json
    echo.
    echo 4. Add Required Scopes
    echo    Visit: https://console.cloud.google.com/auth/scopes
    echo    Add: https://www.googleapis.com/auth/gmail.modify
    echo    Add: https://www.googleapis.com/auth/gmail.settings.basic
    echo.
    echo 5. Add Test User
    echo    Visit: https://console.cloud.google.com/auth/audience
    echo    Add your Google email as test user
    echo.
    echo 6. Place the gcp-oauth.keys.json file in one of these locations:
    echo    - Current directory (where you ran this installer)
    echo    - Your home directory (%USERPROFILE%)
    echo    - Set GMAIL_OAUTH_PATH environment variable
    echo.
)

REM Install dependencies
echo [INFO] Installing dependencies...

if exist "package.json" (
    echo [INFO] Detected local development setup
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to build project
        pause
        exit /b 1
    )
    echo [SUCCESS] Dependencies installed and project built
) else (
    echo [INFO] Using NPM package setup
    call npm install -g @spark-apps/gmail-manager-mcp
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install Gmail Manager MCP
        pause
        exit /b 1
    )
    echo [SUCCESS] Gmail Manager MCP installed globally
)

REM Backup existing config
if exist "%CONFIG_PATH%" (
    for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
    set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
    set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
    set "datestamp=%YYYY%%MM%%DD%_%HH%%Min%%Sec%"
    copy "%CONFIG_PATH%" "%CONFIG_PATH%.backup.%datestamp%"
    echo [SUCCESS] Backup created: %CONFIG_PATH%.backup.%datestamp%
)

REM Create config directory if it doesn't exist
if not exist "%APPDATA%\Claude" mkdir "%APPDATA%\Claude"

REM Update config
echo [INFO] Updating Claude Desktop configuration...

REM Check if config exists and read it
if exist "%CONFIG_PATH%" (
    type "%CONFIG_PATH%" > temp_config.json
    findstr /c:"gmail-manager" temp_config.json >nul
    if %errorlevel%==0 (
        echo [WARNING] Gmail Manager MCP is already configured in Claude Desktop
        set /p UPDATE_CONFIG="Do you want to update the existing configuration? (y/N): "
        if /i not "!UPDATE_CONFIG!"=="y" (
            echo [INFO] Skipping config update
            goto :test_installation
        )
    )
) else (
    echo {} > temp_config.json
)

REM Create new config with Gmail Manager MCP
echo {> "%CONFIG_PATH%"
echo   "mcpServers": {>> "%CONFIG_PATH%"
echo     "gmail-manager": {>> "%CONFIG_PATH%"
echo       "command": "npx",>> "%CONFIG_PATH%"
echo       "args": ["@spark-apps/gmail-manager-mcp"]>> "%CONFIG_PATH%"
echo     }>> "%CONFIG_PATH%"
echo   }>> "%CONFIG_PATH%"
echo }>> "%CONFIG_PATH%"

echo [SUCCESS] Claude Desktop config updated successfully

:test_installation
REM Test installation
echo [INFO] Testing installation...

npx @spark-apps/gmail-manager-mcp --help >nul 2>&1
if %errorlevel% neq 0 (
    npx @spark-apps/gmail-manager-mcp auth >nul 2>&1
    if %errorlevel% neq 0 (
        echo [WARNING] Could not test installation automatically
    ) else (
        echo [SUCCESS] Installation test passed
    )
) else (
    echo [SUCCESS] Installation test passed
)

REM Clean up
if exist temp_config.json del temp_config.json

REM Show completion message
echo.
echo [SUCCESS] Installation completed successfully!
echo.
echo Next steps:
echo 1. Restart Claude Desktop completely
echo 2. Try any Gmail command - authentication will happen automatically
echo 3. Grant permissions when your browser opens
echo.
if %OAUTH_FOUND%==0 (
    echo If you haven't set up OAuth credentials yet, please follow the instructions above.
    echo.
)
echo For help and support, visit: https://github.com/muammar-yacoob/GMail-Manager-MCP
echo.
pause
