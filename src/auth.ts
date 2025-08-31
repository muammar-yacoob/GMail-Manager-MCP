import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import http from 'http';
import { URL } from 'url';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Platform-agnostic config directory
const CONFIG_DIR = path.join(os.homedir(), '.gmail-mcp');

// Platform-agnostic path resolution function
function findFileInPaths(filename: string, possiblePaths: string[]): string | null {
    for (const basePath of possiblePaths) {
        if (!basePath) continue;
        
        const filePath = path.join(basePath, filename);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
}

// Get all possible base paths for file resolution
function getPossibleBasePaths(): string[] {
    const paths = [
        process.cwd(),
        path.dirname(__filename), // dist/
        path.dirname(path.dirname(__filename)), // project root (from dist/)
        path.dirname(path.dirname(path.dirname(__filename))), // parent of project root
        CONFIG_DIR
    ];
    
    // Add environment variable paths
    if (process.env.GMAIL_OAUTH_PATH) {
        paths.unshift(path.dirname(process.env.GMAIL_OAUTH_PATH));
    }
    if (process.env.GMAIL_CREDENTIALS_PATH) {
        paths.unshift(path.dirname(process.env.GMAIL_CREDENTIALS_PATH));
    }
    
    // Remove duplicates and non-existent paths
    return [...new Set(paths)].filter(p => p && fs.existsSync(p));
}

export async function getCredentials(): Promise<OAuth2Client | null> {
    // Only use OAuth keys from the explicitly configured path or project root
    const oauthPath = process.env.GMAIL_OAUTH_PATH || 
                     path.join(process.cwd(), 'gcp-oauth.keys.json');
    
    if (!fs.existsSync(oauthPath)) {
        return null; // Return null instead of throwing
    }
    
    // Find credentials file - only use the configured location
    const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH || 
                           path.join(CONFIG_DIR, 'credentials.json');
    
    
    // Create config directory if needed
    if (!process.env.GMAIL_OAUTH_PATH && !fs.existsSync(path.join(process.cwd(), 'gcp-oauth.keys.json')) && !fs.existsSync(CONFIG_DIR)) {
        try {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        } catch (error) {
            // Ignore mkdir errors in read-only environments
        }
    }
    
    const keysContent = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
    const keys = keysContent.installed || keysContent.web;
    
    if (!keys) {
        throw new Error('Invalid OAuth keys file format. Expected "installed" or "web" key in OAuth file.');
    }
    
    // For desktop apps, use the redirect URI from the keys file or OOB flow
    const redirectUri = keys.redirect_uris?.[0] || "urn:ietf:wg:oauth:2.0:oob";
    const oauth2Client = new OAuth2Client(keys.client_id, keys.client_secret, redirectUri);
    
    if (fs.existsSync(credentialsPath)) {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        oauth2Client.setCredentials(credentials);
        
        // Try to refresh the token if it's expired
        try {
            await oauth2Client.getAccessToken();
        } catch (error) {
            // If token refresh fails, return null to force re-authentication
            return null;
        }
    } else {
        // No credentials file exists, return null to indicate authentication needed
        return null;
    }
    
    return oauth2Client;
}

export async function checkAuthStatus(): Promise<{hasOAuthKeys: boolean, hasCredentials: boolean, credentialsValid: boolean}> {
    // Only use OAuth keys from the explicitly configured path or project root
    const oauthPath = process.env.GMAIL_OAUTH_PATH || 
                     path.join(process.cwd(), 'gcp-oauth.keys.json');
    
    // Find credentials file - only use the configured location
    const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH || 
                           path.join(CONFIG_DIR, 'credentials.json');
    
    const hasOAuthKeys = oauthPath ? fs.existsSync(oauthPath) : false;
    const hasCredentials = credentialsPath ? fs.existsSync(credentialsPath) : false;
    let credentialsValid = false;

    if (hasOAuthKeys && hasCredentials) {
        try {
            const oauth2Client = await getCredentials();
            if (oauth2Client) {
                await oauth2Client.getAccessToken();
                credentialsValid = true;
            }
        } catch (error) {
            credentialsValid = false;
        }
    }

    return { hasOAuthKeys, hasCredentials, credentialsValid };
}

// Get OAuth client, creating one if needed but without credentials
export async function getOAuthClient(): Promise<OAuth2Client | null> {
    // Only use OAuth keys from the explicitly configured path or project root
    const oauthPath = process.env.GMAIL_OAUTH_PATH || 
                     path.join(process.cwd(), 'gcp-oauth.keys.json');
    
    if (!fs.existsSync(oauthPath)) {
        return null;
    }
    
    const keysContent = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
    const keys = keysContent.installed || keysContent.web;
    
    if (!keys) {
        throw new Error('Invalid OAuth keys file format. Expected "installed" or "web" key in OAuth file.');
    }
    
    const redirectUri = keys.redirect_uris?.[0] || "urn:ietf:wg:oauth:2.0:oob";
    return new OAuth2Client(keys.client_id, keys.client_secret, redirectUri);
}

// Check if OAuth client has valid credentials
export async function hasValidCredentials(oauth2Client: OAuth2Client): Promise<boolean> {
    try {
        const credentials = oauth2Client.credentials;
        if (!credentials || !credentials.refresh_token) {
            return false;
        }
        await oauth2Client.getAccessToken();
        return true;
    } catch {
        return false;
    }
}

export async function authenticateWeb(oauth2Client: OAuth2Client, credentialsPath?: string): Promise<void> {
    const creds = credentialsPath || path.join(CONFIG_DIR, 'credentials.json');
    
    return new Promise((resolve, reject) => {
        let server: http.Server;
        const port = 3000;
        const redirectUri = `http://localhost:${port}/oauth/callback`;
        
        // Create a new OAuth client with localhost redirect URI
        const webOAuth2Client = new OAuth2Client(
            (oauth2Client as any)._clientId,
            (oauth2Client as any)._clientSecret,
            redirectUri
        );
        
        const authUrl = webOAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.settings.basic']
        });
        
        server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url!, `http://localhost:${port}`);
                
                if (url.pathname === '/oauth/callback') {
                    const code = url.searchParams.get('code');
                    
                    if (code) {
                        const { tokens } = await webOAuth2Client.getToken(code);
                        oauth2Client.setCredentials(tokens);
                        
                        // Ensure the directory exists
                        const credsDir = path.dirname(creds);
                        if (!fs.existsSync(credsDir)) {
                            fs.mkdirSync(credsDir, { recursive: true });
                        }
                        
                        // Save credentials
                        fs.writeFileSync(creds, JSON.stringify(tokens, null, 2));
                        
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
                            <!DOCTYPE html>
                            <html lang="en">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>Gmail Manager - Authentication Successful</title>
                                <style>
                                    * {
                                        margin: 0;
                                        padding: 0;
                                        box-sizing: border-box;
                                    }
                                    
                                    body {
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                        background: linear-gradient(-45deg, #667eea, #764ba2, #f093fb, #f5576c);
                                        background-size: 400% 400%;
                                        animation: gradientBG 3s ease infinite;
                                        min-height: 100vh;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        color: #333;
                                    }
                                    
                                    @keyframes gradientBG {
                                        0% { background-position: 0% 50%; }
                                        50% { background-position: 100% 50%; }
                                        100% { background-position: 0% 50%; }
                                    }
                                    
                                    .container {
                                        background: white;
                                        border-radius: 20px;
                                        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                                        padding: 40px;
                                        text-align: center;
                                        max-width: 500px;
                                        width: 90%;
                                        animation: slideUp 0.6s ease-out;
                                    }
                                    
                                    @keyframes slideUp {
                                        from {
                                            opacity: 0;
                                            transform: translateY(30px);
                                        }
                                        to {
                                            opacity: 1;
                                            transform: translateY(0);
                                        }
                                    }
                                    
                                    .success-icon {
                                        width: 80px;
                                        height: 80px;
                                        background: linear-gradient(135deg, #4CAF50, #45a049);
                                        border-radius: 50%;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        margin: 0 auto 20px;
                                        animation: pulse 2s infinite;
                                    }
                                    
                                    @keyframes pulse {
                                        0% { transform: scale(1); }
                                        50% { transform: scale(1.05); }
                                        100% { transform: scale(1); }
                                    }
                                    
                                    .success-icon::before {
                                        content: "✓";
                                        color: white;
                                        font-size: 40px;
                                        font-weight: bold;
                                    }
                                    
                                    h1 {
                                        color: #2c3e50;
                                        margin-bottom: 15px;
                                        font-size: 28px;
                                        font-weight: 600;
                                    }
                                    
                                    .message {
                                        color: #7f8c8d;
                                        font-size: 16px;
                                        line-height: 1.6;
                                        margin-bottom: 30px;
                                    }
                                    
                                    .features {
                                        background: #f8f9fa;
                                        border-radius: 12px;
                                        padding: 20px;
                                        margin: 20px 0;
                                        text-align: left;
                                    }
                                    
                                    .features h3 {
                                        color: #2c3e50;
                                        margin-bottom: 10px;
                                        font-size: 18px;
                                    }
                                    
                                    .features ul {
                                        list-style: none;
                                        color: #7f8c8d;
                                    }
                                    
                                    .features li {
                                        margin: 8px 0;
                                        padding-left: 20px;
                                        position: relative;
                                    }
                                    
                                    .features li::before {
                                        content: "•";
                                        color: #4CAF50;
                                        font-weight: bold;
                                        position: absolute;
                                        left: 0;
                                    }
                                    
                                    .action-buttons {
                                        text-align: center;
                                        margin-top: 30px;
                                    }
                                    
                                    .btn {
                                        padding: 12px 24px;
                                        border: none;
                                        border-radius: 8px;
                                        font-size: 16px;
                                        font-weight: 500;
                                        cursor: pointer;
                                        transition: all 0.3s ease;
                                        text-decoration: none;
                                        display: inline-block;
                                        text-align: center;
                                    }
                                    
                                    .btn-primary {
                                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                        color: white;
                                    }
                                    
                                    .btn-secondary {
                                        background: #f8f9fa;
                                        color: #6c757d;
                                        border: 2px solid #e9ecef;
                                    }
                                    
                                    .btn:hover {
                                        transform: translateY(-2px);
                                        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
                                    }
                                    
                                    .btn-primary:hover {
                                        background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
                                    }
                                    
                                    .btn-secondary:hover {
                                        background: #e9ecef;
                                        border-color: #dee2e6;
                                    }
                                    
                                    .accordion {
                                        margin: 20px 0;
                                    }
                                    
                                    .accordion-item {
                                        border: 1px solid #e9ecef;
                                        border-radius: 8px;
                                        margin-bottom: 10px;
                                        overflow: hidden;
                                    }
                                    
                                    .accordion-header {
                                        background: #f8f9fa;
                                        padding: 15px 20px;
                                        cursor: pointer;
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        font-weight: 600;
                                        color: #2c3e50;
                                        transition: all 0.3s ease;
                                    }
                                    
                                    .accordion-header:hover {
                                        background: #e9ecef;
                                    }
                                    
                                    .accordion-icon {
                                        transition: transform 0.3s ease;
                                    }
                                    
                                    .accordion-content {
                                        max-height: 0;
                                        overflow: hidden;
                                        transition: max-height 0.3s ease;
                                        background: white;
                                    }
                                    
                                    .accordion-content.active {
                                        max-height: 400px;
                                    }
                                    
                                    .accordion-body {
                                        padding: 15px 20px;
                                        color: #7f8c8d;
                                        font-size: 14px;
                                    }
                                    
                                    .example-list {
                                        list-style: none;
                                        margin: 0;
                                        padding: 0;
                                    }
                                    
                                    .example-list li {
                                        margin: 8px 0;
                                        padding: 8px 12px;
                                        background: #f8f9fa;
                                        border-radius: 6px;
                                        font-style: italic;
                                        border-left: 3px solid #4CAF50;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="success-icon"></div>
                                    <h1>🎉 Authentication Successful!</h1>
                                    <div style="text-align: center; margin: 20px 0;">
                                        <img src="/images/cleaning-images/cleaning${Math.floor(Math.random() * 5) + 1}.gif" alt="Cleaning animation" style="max-width: 150px; border-radius: 10px;" onerror="this.style.display='none';">
                                    </div>
                                    <p class="message">
                                        🔗 Gmail Manager is now connected to your Gmail account! 
                                        Ready to clean up your inbox like a pro! ✨
                                    </p>
                                    
                                    <div class="accordion">
                                        <div class="accordion-item">
                                            <div class="accordion-header" onclick="toggleAccordion(this)">
                                                <span>🧹 Storage Cleanup Commands</span>
                                                <span class="accordion-icon">▼</span>
                                            </div>
                                            <div class="accordion-content">
                                                <div class="accordion-body">
                                                    <ul class="example-list">
                                                        <li>"Delete all emails from noreply addresses older than 6 months"</li>
                                                        <li>"Find and delete all promotional emails from shopping sites"</li>
                                                        <li>"Remove all LinkedIn notification emails from the past year"</li>
                                                        <li>"Delete all automated emails from GitHub, Slack, and Jira"</li>
                                                        <li>"Clean up all newsletter emails I haven't opened in 3 months"</li>
                                                        <li>"Remove all calendar invites and meeting reminders older than 30 days"</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="accordion-item">
                                            <div class="accordion-header" onclick="toggleAccordion(this)">
                                                <span>📊 Smart Organization</span>
                                                <span class="accordion-icon">▼</span>
                                            </div>
                                            <div class="accordion-content">
                                                <div class="accordion-body">
                                                    <ul class="example-list">
                                                        <li>"Label all emails from banks and financial institutions as 'Finance'"</li>
                                                        <li>"Create 'Archive-2024' label and move all old work emails there"</li>
                                                        <li>"Find all subscription confirmation emails and label them 'Subscriptions'"</li>
                                                        <li>"Group all travel booking confirmations under 'Travel' label"</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="accordion-item">
                                            <div class="accordion-header" onclick="toggleAccordion(this)">
                                                <span>🔍 Inbox Analysis</span>
                                                <span class="accordion-icon">▼</span>
                                            </div>
                                            <div class="accordion-content">
                                                <div class="accordion-body">
                                                    <ul class="example-list">
                                                        <li>"Show me my top 10 email senders by volume this year"</li>
                                                        <li>"Find all unread emails older than 1 month"</li>
                                                        <li>"List all emails taking up the most storage space"</li>
                                                        <li>"Analyze my email patterns and suggest cleanup strategies"</li>
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="action-buttons">
                                        <a href="https://spark-games.co.uk" class="btn btn-primary">
                                            🚀 Explore More Tools
                                        </a>
                                    </div>
                                </div>
                                
                                <script>
                                    function toggleAccordion(header) {
                                        const content = header.nextElementSibling;
                                        const icon = header.querySelector('.accordion-icon');
                                        
                                        // Close all other accordions
                                        document.querySelectorAll('.accordion-content').forEach(item => {
                                            if (item !== content) {
                                                item.classList.remove('active');
                                                item.previousElementSibling.querySelector('.accordion-icon').style.transform = 'rotate(0deg)';
                                            }
                                        });
                                        
                                        // Toggle current accordion
                                        content.classList.toggle('active');
                                        const isActive = content.classList.contains('active');
                                        icon.style.transform = isActive ? 'rotate(180deg)' : 'rotate(0deg)';
                                    }
                                </script>
                            </body>
                            </html>
                        `);
                        
                        server.close();
                        resolve();
                    } else {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(`
                            <!DOCTYPE html>
                            <html lang="en">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>Gmail Manager - Authentication Failed</title>
                                <style>
                                    * {
                                        margin: 0;
                                        padding: 0;
                                        box-sizing: border-box;
                                    }
                                    
                                    body {
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                                        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                                        min-height: 100vh;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        color: #333;
                                    }
                                    
                                    .container {
                                        background: white;
                                        border-radius: 20px;
                                        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                                        padding: 40px;
                                        text-align: center;
                                        max-width: 500px;
                                        width: 90%;
                                        animation: slideUp 0.6s ease-out;
                                    }
                                    
                                    @keyframes slideUp {
                                        from {
                                            opacity: 0;
                                            transform: translateY(30px);
                                        }
                                        to {
                                            opacity: 1;
                                            transform: translateY(0);
                                        }
                                    }
                                    
                                    .error-icon {
                                        width: 80px;
                                        height: 80px;
                                        background: linear-gradient(135deg, #ff6b6b, #ee5a24);
                                        border-radius: 50%;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        margin: 0 auto 20px;
                                    }
                                    
                                    .error-icon::before {
                                        content: "✕";
                                        color: white;
                                        font-size: 40px;
                                        font-weight: bold;
                                    }
                                    
                                    h1 {
                                        color: #2c3e50;
                                        margin-bottom: 15px;
                                        font-size: 28px;
                                        font-weight: 600;
                                    }
                                    
                                    .message {
                                        color: #7f8c8d;
                                        font-size: 16px;
                                        line-height: 1.6;
                                        margin-bottom: 30px;
                                    }
                                    
                                    .retry-button {
                                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                        color: white;
                                        border: none;
                                        padding: 12px 24px;
                                        border-radius: 8px;
                                        font-size: 16px;
                                        cursor: pointer;
                                        transition: transform 0.2s;
                                        margin-top: 20px;
                                    }
                                    
                                    .retry-button:hover {
                                        transform: translateY(-2px);
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="error-icon"></div>
                                    <h1>Authentication Failed</h1>
                                    <p class="message">
                                        No authorization code was received from Google. 
                                        This might happen if you cancelled the authentication process.
                                    </p>
                                    <button class="retry-button" onclick="window.close()">Close Window</button>
                                </div>
                            </body>
                            </html>
                        `);
                        server.close();
                        reject(new Error('No authorization code received'));
                    }
                } else if (url.pathname === '/') {
                    // Landing page - redirect to Google OAuth
                    res.writeHead(302, { 'Location': authUrl });
                    res.end();
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`<h1>Authentication Error</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p>`);
                server.close();
                reject(error);
            }
        });
        
        server.listen(port, async () => {
            console.error(`\nOpening authentication in your browser...`);
            console.error(`\nIf the browser doesn't open automatically, please visit:`);
            console.error(`\n${authUrl}\n`);
            
            // Open browser (platform-agnostic)
            const { exec } = await import('child_process');
            const platform = os.platform();
            
            // Check if we're in WSL
            const isWSL = fs.existsSync('/proc/version') && 
                         fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
            
            if (isWSL) {
                // In WSL, use Windows' cmd.exe to open the browser
                exec(`cmd.exe /c start "${authUrl}"`, (error) => {
                    if (error) {
                        // Try PowerShell as fallback
                        exec(`powershell.exe -Command "Start-Process '${authUrl}'"`, (error2) => {
                            if (error2) {
                                console.error('Could not open browser automatically. Please open the URL manually.');
                            }
                        });
                    }
                });
            } else if (platform === 'darwin') {
                exec(`open "${authUrl}"`, (error) => {
                    if (error) {
                        console.error('Could not open browser automatically. Please open the URL manually.');
                    }
                });
            } else if (platform === 'win32') {
                exec(`cmd.exe /c start "" "${authUrl}"`, (error) => {
                    if (error) {
                        console.error('Could not open browser automatically. Please open the URL manually.');
                    }
                });
            } else {
                // Linux
                exec(`xdg-open "${authUrl}"`, (error) => {
                    if (error) {
                        // Try alternative methods
                        exec(`sensible-browser "${authUrl}"`, (error2) => {
                            if (error2) {
                                console.error('Could not open browser automatically. Please open the URL manually.');
                            }
                        });
                    }
                });
            }
        });
        
        server.on('error', (error) => {
            if ((error as any).code === 'EADDRINUSE') {
                // Port 3000 is in use
            }
            reject(error);
        });
    });
}

export async function authenticate(oauth2Client: OAuth2Client, credentialsPath?: string): Promise<void> {
    const creds = credentialsPath || path.join(CONFIG_DIR, 'credentials.json');
    
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.settings.basic']
    });
    
            // Terminal authentication flow
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve, reject) => {
        rl.question('Authorization code: ', async (code) => {
            try {
                rl.close();
                
                const { tokens } = await oauth2Client.getToken(code);
                oauth2Client.setCredentials(tokens);
                
                // Ensure the directory exists
                const credsDir = path.dirname(creds);
                if (!fs.existsSync(credsDir)) {
                    fs.mkdirSync(credsDir, { recursive: true });
                }
                
                // Save credentials
                fs.writeFileSync(creds, JSON.stringify(tokens, null, 2));
                
                // Authentication successful
                resolve();
            } catch (error) {
                rl.close();
                reject(error);
            }
        });
    });
}