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

export async function getCredentials(): Promise<OAuth2Client> {
    const possibleBasePaths = getPossibleBasePaths();
    
    // Find OAuth keys file
    const oauthPath = process.env.GMAIL_OAUTH_PATH || 
                     findFileInPaths('gcp-oauth.keys.json', possibleBasePaths);
    
    if (!oauthPath || !fs.existsSync(oauthPath)) {
        throw new Error(`OAuth keys file not found. Checked paths: ${possibleBasePaths.join(', ')}. Please place gcp-oauth.keys.json in project root or set GMAIL_OAUTH_PATH environment variable.`);
    }
    
    // Find credentials file
    const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH || 
                           findFileInPaths('credentials.json', possibleBasePaths) ||
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
            // If token refresh fails, the credentials are invalid
            throw new Error('Stored credentials are invalid or expired. Please run authentication again.');
        }
    }
    
    return oauth2Client;
}

export async function checkAuthStatus(): Promise<{hasOAuthKeys: boolean, hasCredentials: boolean, credentialsValid: boolean}> {
    const possibleBasePaths = getPossibleBasePaths();
    
    // Find OAuth keys file
    const oauthPath = process.env.GMAIL_OAUTH_PATH || 
                     findFileInPaths('gcp-oauth.keys.json', possibleBasePaths);
    
    // Find credentials file
    const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH || 
                           findFileInPaths('credentials.json', possibleBasePaths) ||
                           path.join(CONFIG_DIR, 'credentials.json');
    
    const hasOAuthKeys = oauthPath ? fs.existsSync(oauthPath) : false;
    const hasCredentials = credentialsPath ? fs.existsSync(credentialsPath) : false;
    let credentialsValid = false;

    if (hasOAuthKeys && hasCredentials) {
        try {
            const oauth2Client = await getCredentials();
            await oauth2Client.getAccessToken();
            credentialsValid = true;
        } catch (error) {
            credentialsValid = false;
        }
    }

    return { hasOAuthKeys, hasCredentials, credentialsValid };
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
                                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                                    
                                    .close-notice {
                                        background: #e8f5e8;
                                        border: 1px solid #4CAF50;
                                        border-radius: 8px;
                                        padding: 15px;
                                        color: #2e7d32;
                                        font-size: 14px;
                                        margin-top: 20px;
                                    }
                                    
                                    .countdown {
                                        font-weight: bold;
                                        color: #4CAF50;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="success-icon"></div>
                                    <h1>🎉 Authentication Successful!</h1>
                                    <p class="message">
                                        Gmail Manager is now connected to your Gmail account. 
                                        You can close this window and return to Claude Desktop.
                                    </p>
                                    
                                    <div class="features">
                                        <h3>🚀 What you can do now:</h3>
                                        <ul>
                                            <li>Search and filter emails with natural language</li>
                                            <li>Bulk delete unwanted emails</li>
                                            <li>Organize inbox with smart labels</li>
                                            <li>Clean up newsletters and spam</li>
                                            <li>Analyze your email patterns</li>
                                        </ul>
                                    </div>
                                    
                                    <div class="close-notice">
                                        <span class="countdown" id="countdown">2</span> seconds until this window closes automatically
                                    </div>
                                </div>
                                
                                <script>
                                    let countdown = 2;
                                    const countdownElement = document.getElementById('countdown');
                                    
                                    const timer = setInterval(() => {
                                        countdown--;
                                        countdownElement.textContent = countdown;
                                        
                                        if (countdown <= 0) {
                                            clearInterval(timer);
                                            window.close();
                                        }
                                    }, 1000);
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
                                    <h1>❌ Authentication Failed</h1>
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
            console.log(`🌐 Opening browser for Gmail authentication...`);
            console.log(`🔗 Auth URL: ${authUrl}`);
            
            // Open browser (platform-agnostic)
            const { exec } = await import('child_process');
            const platform = os.platform();
            
            let command: string;
            if (platform === 'darwin') {
                command = 'open';
            } else if (platform === 'win32') {
                command = 'start';
            } else {
                command = 'xdg-open';
            }
            
            exec(`${command} "${authUrl}"`, (error) => {
                if (error) {
                    console.log(`⚠️  Could not open browser automatically. Please visit: ${authUrl}`);
                }
            });
        });
        
        server.on('error', (error) => {
            if ((error as any).code === 'EADDRINUSE') {
                console.log('⚠️  Port 3000 is in use. Please close any applications using this port and try again.');
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
    
    console.log('🔗 Please visit this URL to authorize the application:');
    console.log(authUrl);
    console.log('\n📋 Enter the authorization code:');
    
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
                
                console.log('✅ Authentication successful! Credentials saved.');
                resolve();
            } catch (error) {
                rl.close();
                reject(error);
            }
        });
    });
}