import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import http from 'http';
import { URL } from 'url';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAuthSuccessHTML(): string {
    const htmlPath = path.join(__dirname, '..', 'public', 'auth-pages', 'auth-success.html');
    const cssPath = path.join(__dirname, '..', 'public', 'css', 'auth-success.css');
    const jsPath = path.join(__dirname, '..', 'public', 'js', 'auth-success.js');
    const commandsPath = path.join(__dirname, '..', 'public', 'data', 'commands.json');
    
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // If CSS file exists, inject it inline
    if (fs.existsSync(cssPath)) {
        const css = fs.readFileSync(cssPath, 'utf8');
        html = html.replace(
            '<link rel="stylesheet" href="/css/auth-success.css">',
            `<style>\n${css}\n    </style>`
        );
    }
    
    // If JavaScript file exists, inject it inline
    if (fs.existsSync(jsPath)) {
        let js = fs.readFileSync(jsPath, 'utf8');
        
        // If commands.json exists, inject the data inline to avoid fetch issues
        if (fs.existsSync(commandsPath)) {
            const commandsData = fs.readFileSync(commandsPath, 'utf8');
            
            // Replace the fetch call with inline data
            js = js.replace(
                /const response = await fetch\('\/data\/commands\.json'\);[\s\S]*?const data = await response\.json\(\);/,
                `const data = ${commandsData};`
            );
            
            // Remove the console logs related to fetch since we're using inline data
            js = js.replace(/console\.log\('🔄 Loading commands from \/data\/commands\.json\.\.\.'\);/, '');
            js = js.replace(/console\.log\('Current URL:', window\.location\.href\);/, '');
            js = js.replace(/console\.log\('Fetch URL will be:', new URL\('\/data\/commands\.json', window\.location\.origin\)\.href\);/, '');
            js = js.replace(/console\.log\('📡 Response received:', \{[\s\S]*?\}\);/, '');
            js = js.replace(/if \(!response\.ok\) \{[\s\S]*?\}/, '');
        }
        
        html = html.replace(
            '<script src="/js/auth-success.js"></script>',
            `<script>\n${js}\n    </script>`
        );
    }
    
    return html;
}

function getAuthFailedHTML(): string {
    const htmlPath = path.join(__dirname, '..', 'public', 'auth-pages', 'auth-failed.html');
    const cssPath = path.join(__dirname, '..', 'public', 'css', 'auth-failed.css');
    
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // If CSS file exists, inject it inline
    if (fs.existsSync(cssPath)) {
        const css = fs.readFileSync(cssPath, 'utf8');
        html = html.replace(
            '<link rel="stylesheet" href="/css/auth-failed.css">',
            `<style>\n${css}\n    </style>`
        );
    }
    
    return html;
}

function getAuthErrorHTML(): string {
    const htmlPath = path.join(__dirname, '..', 'public', 'auth-pages', 'auth-failed.html');
    return fs.readFileSync(htmlPath, 'utf8');
}

const CONFIG_DIR = path.join(os.homedir(), '.gmail-mcp');

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

// Find OAuth keys file
function findOAuthKeys(): string | null {
    const possiblePaths = getPossibleBasePaths();
    return findFileInPaths('gcp-oauth.keys.json', possiblePaths);
}

// Find credentials file
function findCredentials(): string | null {
    if (process.env.GMAIL_CREDENTIALS_PATH) {
        return fs.existsSync(process.env.GMAIL_CREDENTIALS_PATH) ? process.env.GMAIL_CREDENTIALS_PATH : null;
    }
    
    const defaultPath = path.join(CONFIG_DIR, 'credentials.json');
    return fs.existsSync(defaultPath) ? defaultPath : null;
}

// Setup authentication
export async function setupAuth(): Promise<OAuth2Client> {
    console.error('Setting up Gmail authentication...');
    
    const oauthKeysPath = findOAuthKeys();
    if (!oauthKeysPath) {
        console.error('\nError: gcp-oauth.keys.json not found!');
        console.error('Please ensure the OAuth keys file is in one of these locations:');
        getPossibleBasePaths().forEach(p => console.error(`  - ${p}/gcp-oauth.keys.json`));
        console.error('\nOr set the GMAIL_OAUTH_PATH environment variable to point to the file.');
        throw new Error('OAuth keys file not found');
    }

    try {
        const credentials = JSON.parse(fs.readFileSync(oauthKeysPath, 'utf8'));
        
        if (!credentials.web && !credentials.installed) {
            throw new Error('Invalid OAuth credentials file format');
        }
        
        const clientConfig = credentials.web || credentials.installed;
        const oauth2Client = new OAuth2Client(
            clientConfig.client_id,
            clientConfig.client_secret,
            clientConfig.redirect_uris[0]
        );

        return authenticateUser(oauth2Client);
    } catch (error) {
        console.error('Error reading OAuth keys:', error);
        throw error;
    }
}

// Authenticate user with browser flow
async function authenticateUser(oauth2Client: OAuth2Client): Promise<OAuth2Client> {
    const scopes = ['https://mail.google.com/'];
    
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url!, `http://${req.headers.host}`);
                
                if (url.pathname === '/') {
                    if (url.searchParams.has('code')) {
                        const code = url.searchParams.get('code')!;
                        const { tokens } = await oauth2Client.getToken(code);
                        oauth2Client.setCredentials(tokens);
                        
                        // Save credentials
                        if (!fs.existsSync(CONFIG_DIR)) {
                            fs.mkdirSync(CONFIG_DIR, { recursive: true });
                        }
                        
                        const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH || path.join(CONFIG_DIR, 'credentials.json');
                        fs.writeFileSync(credentialsPath, JSON.stringify(tokens, null, 2));
                        console.error(`Credentials saved to: ${credentialsPath}`);
                        
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(getAuthSuccessHTML());
                        
                        server.close(() => {
                            resolve(oauth2Client);
                        });
                    } else if (url.searchParams.has('error')) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(getAuthFailedHTML());
                        
                        server.close(() => {
                            reject(new Error('Authentication failed: ' + url.searchParams.get('error')));
                        });
                    } else {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(getAuthErrorHTML());
                    }
                } else if (url.pathname.startsWith('/images/')) {
                    // Serve static images
                    const imagePath = path.join(__dirname, '..', 'public', url.pathname);
                    try {
                        if (fs.existsSync(imagePath)) {
                            const imageData = fs.readFileSync(imagePath);
                            const ext = path.extname(imagePath).toLowerCase();
                            let contentType = 'application/octet-stream';
                            if (ext === '.gif') contentType = 'image/gif';
                            else if (ext === '.png') contentType = 'image/png';
                            else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
                            
                            res.writeHead(200, { 'Content-Type': contentType });
                            res.end(imageData);
                        } else {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('Image not found');
                        }
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error serving image');
                    }
                } else if (url.pathname.startsWith('/css/')) {
                    // Serve CSS files
                    const cssPath = path.join(__dirname, '..', 'public', url.pathname);
                    try {
                        if (fs.existsSync(cssPath) && path.extname(cssPath).toLowerCase() === '.css') {
                            const cssData = fs.readFileSync(cssPath, 'utf8');
                            res.writeHead(200, { 'Content-Type': 'text/css' });
                            res.end(cssData);
                        } else {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('CSS file not found');
                        }
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error serving CSS file');
                    }
                } else if (url.pathname.startsWith('/data/')) {
                    // Serve JSON data files
                    const dataPath = path.join(__dirname, '..', 'public', url.pathname);
                    try {
                        if (fs.existsSync(dataPath) && path.extname(dataPath).toLowerCase() === '.json') {
                            const jsonData = fs.readFileSync(dataPath, 'utf8');
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(jsonData);
                        } else {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('Data file not found');
                        }
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error serving data file');
                    }
                } else if (url.pathname.startsWith('/js/')) {
                    // Serve JavaScript files
                    const jsPath = path.join(__dirname, '..', 'public', url.pathname);
                    try {
                        if (fs.existsSync(jsPath) && path.extname(jsPath).toLowerCase() === '.js') {
                            const jsData = fs.readFileSync(jsPath, 'utf8');
                            res.writeHead(200, { 'Content-Type': 'application/javascript' });
                            res.end(jsData);
                        } else {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('JavaScript file not found');
                        }
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error serving JavaScript file');
                    }
                } else {
                    res.writeHead(404);
                    res.end('Not found');
                }
            } catch (error) {
                console.error('Error in OAuth callback:', error);
                // Only send error response if headers haven't been sent yet
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end(getAuthErrorHTML());
                }
                
                server.close(() => {
                    reject(error);
                });
            }
        });
        
        server.listen(0, () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('Failed to start OAuth server'));
                return;
            }
            
            const port = address.port;
            const redirectUri = `http://localhost:${port}`;
            
            // Update the OAuth client with the dynamic redirect URI
            const clientConfig = oauth2Client._clientId ? {
                client_id: oauth2Client._clientId,
                client_secret: oauth2Client._clientSecret,
                redirect_uris: [redirectUri]
            } : null;
            
            if (clientConfig) {
                oauth2Client = new OAuth2Client(
                    clientConfig.client_id,
                    clientConfig.client_secret,
                    redirectUri
                );
            }
            
            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                prompt: 'consent'
            });
            
            console.error(`\nPlease visit this URL to authorize the application:`);
            console.error(`${authUrl}\n`);
            console.error(`Waiting for authorization...`);
            
            // Try to open the URL automatically
            const platform = process.platform;
            let command = '';
            
            if (platform === 'darwin') {
                command = `open "${authUrl}"`;
            } else if (platform === 'win32') {
                command = `start "" "${authUrl}"`;
            } else {
                command = `xdg-open "${authUrl}"`;
            }
            
            exec(command, (error: any) => {
                if (error) {
                    console.error('Could not automatically open browser. Please manually visit the URL above.');
                }
            });
        });
        
        // Add timeout
        const timeout = setTimeout(() => {
            server.close();
            reject(new Error('Authentication timeout (5 minutes)'));
        }, 5 * 60 * 1000); // 5 minutes
        
        server.on('close', () => {
            clearTimeout(timeout);
        });
    });
}

// Load existing credentials
export function loadCredentials(): OAuth2Client | null {
    try {
        const credentialsPath = findCredentials();
        if (!credentialsPath) {
            return null;
        }
        
        const oauthKeysPath = findOAuthKeys();
        if (!oauthKeysPath) {
            console.error('OAuth keys file not found, cannot load credentials');
            return null;
        }
        
        const credentials = JSON.parse(fs.readFileSync(oauthKeysPath, 'utf8'));
        const clientConfig = credentials.web || credentials.installed;
        
        const oauth2Client = new OAuth2Client(
            clientConfig.client_id,
            clientConfig.client_secret,
            clientConfig.redirect_uris[0]
        );
        
        const tokens = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        oauth2Client.setCredentials(tokens);
        
        return oauth2Client;
    } catch (error) {
        console.error('Error loading credentials:', error);
        return null;
    }
}

// Get authenticated client (load existing or setup new)
export async function getAuthenticatedClient(): Promise<OAuth2Client> {
    const existingClient = loadCredentials();
    if (existingClient) {
        return existingClient;
    }
    
    return setupAuth();
}

// Debug authentication
export async function debugAuth(): Promise<void> {
    console.error('=== Gmail MCP Authentication Debug ===\n');
    
    // Check OAuth keys
    const oauthKeysPath = findOAuthKeys();
    console.error('OAuth Keys File:');
    if (oauthKeysPath) {
        console.error(`  Found: ${oauthKeysPath}`);
        try {
            const credentials = JSON.parse(fs.readFileSync(oauthKeysPath, 'utf8'));
            const clientConfig = credentials.web || credentials.installed;
            console.error(`  Client ID: ${clientConfig.client_id.substring(0, 10)}...`);
            console.error(`  Redirect URIs: ${clientConfig.redirect_uris.length} configured`);
        } catch (error) {
            console.error(`  Error reading file: ${error}`);
        }
    } else {
        console.error('  Not found in any of these locations:');
        getPossibleBasePaths().forEach(p => console.error(`    - ${p}/gcp-oauth.keys.json`));
    }
    
    console.error('\nSaved Credentials:');
    const credentialsPath = findCredentials();
    if (credentialsPath) {
        console.error(`  Found: ${credentialsPath}`);
        try {
            const tokens = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            console.error(`  Access token: ${tokens.access_token ? 'Present' : 'Missing'}`);
            console.error(`  Refresh token: ${tokens.refresh_token ? 'Present' : 'Missing'}`);
            console.error(`  Expiry: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'Not set'}`);
        } catch (error) {
            console.error(`  Error reading file: ${error}`);
        }
    } else {
        console.error('  Not found');
    }
    
    console.error('\nEnvironment Variables:');
    console.error(`  GMAIL_OAUTH_PATH: ${process.env.GMAIL_OAUTH_PATH || 'Not set'}`);
    console.error(`  GMAIL_CREDENTIALS_PATH: ${process.env.GMAIL_CREDENTIALS_PATH || 'Not set'}`);
    
    console.error('\nTesting Authentication:');
    try {
        const client = await getAuthenticatedClient();
        console.error('  Authentication successful!');
        
        // Test API access
        const { google } = await import('googleapis');
        const gmail = google.gmail({ version: 'v1', auth: client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        console.error(`  Gmail API access successful for: ${profile.data.emailAddress}`);
        
    } catch (error) {
        console.error(`  Authentication failed: ${error}`);
    }
    
    console.error('\n=== Debug Complete ===');
}

export async function getCredentials(): Promise<OAuth2Client | null> {
    // Use OAuth keys from environment variable or project root (not current working directory)  
    const projectRoot = path.dirname(__dirname); // Go up from dist/ to project root
    const oauthPath = process.env.GMAIL_OAUTH_PATH || 
                     path.join(projectRoot, 'gcp-oauth.keys.json');
    
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
    // Use OAuth keys from environment variable or project root (not current working directory)  
    const projectRoot = path.dirname(__dirname); // Go up from dist/ to project root
    const oauthPath = process.env.GMAIL_OAUTH_PATH || 
                     path.join(projectRoot, 'gcp-oauth.keys.json');
    
    // Find credentials file - only use the configured location
    const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH || 
                           path.join(CONFIG_DIR, 'credentials.json');
    
    const hasOAuthKeys = oauthPath ? fs.existsSync(oauthPath) : false;
    const hasCredentials = credentialsPath ? fs.existsSync(credentialsPath) : false;
    let credentialsValid = false;

    if (hasOAuthKeys && hasCredentials) {
        try {
            const client = await getCredentials();
            credentialsValid = client !== null;
        } catch {
            credentialsValid = false;
        }
    }

    return { hasOAuthKeys, hasCredentials, credentialsValid };
}

export async function getOAuthClient(): Promise<OAuth2Client | null> {
    // Use OAuth keys from environment variable or project root (not current working directory)  
    const projectRoot = path.dirname(__dirname); // Go up from dist/ to project root
    const oauthPath = process.env.GMAIL_OAUTH_PATH || 
                     path.join(projectRoot, 'gcp-oauth.keys.json');
    
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
            scope: ['https://mail.google.com/']
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
                        res.end(getAuthSuccessHTML());
                        
                        server.close();
                        resolve();
                    } else {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(getAuthFailedHTML());
                        server.close();
                        reject(new Error('No authorization code received'));
                    }
                } else if (url.pathname === '/') {
                    // Landing page - redirect to Google OAuth
                    res.writeHead(302, { 'Location': authUrl });
                    res.end();
                } else if (url.pathname.startsWith('/images/')) {
                    // Serve static images
                    const imagePath = path.join(__dirname, '..', 'public', url.pathname);
                    try {
                        if (fs.existsSync(imagePath)) {
                            const imageData = fs.readFileSync(imagePath);
                            const ext = path.extname(imagePath).toLowerCase();
                            let contentType = 'application/octet-stream';
                            if (ext === '.gif') contentType = 'image/gif';
                            else if (ext === '.png') contentType = 'image/png';
                            else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
                            
                            res.writeHead(200, { 'Content-Type': contentType });
                            res.end(imageData);
                        } else {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('Image not found');
                        }
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error serving image');
                    }
                } else if (url.pathname.startsWith('/css/')) {
                    // Serve CSS files
                    const cssPath = path.join(__dirname, '..', 'public', url.pathname);
                    try {
                        if (fs.existsSync(cssPath) && path.extname(cssPath).toLowerCase() === '.css') {
                            const cssData = fs.readFileSync(cssPath, 'utf8');
                            res.writeHead(200, { 'Content-Type': 'text/css' });
                            res.end(cssData);
                        } else {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('CSS file not found');
                        }
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error serving CSS file');
                    }
                } else if (url.pathname.startsWith('/data/')) {
                    // Serve JSON data files
                    const dataPath = path.join(__dirname, '..', 'public', url.pathname);
                    try {
                        if (fs.existsSync(dataPath) && path.extname(dataPath).toLowerCase() === '.json') {
                            const jsonData = fs.readFileSync(dataPath, 'utf8');
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(jsonData);
                        } else {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('Data file not found');
                        }
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error serving data file');
                    }
                } else if (url.pathname.startsWith('/js/')) {
                    // Serve JavaScript files
                    const jsPath = path.join(__dirname, '..', 'public', url.pathname);
                    try {
                        if (fs.existsSync(jsPath) && path.extname(jsPath).toLowerCase() === '.js') {
                            const jsData = fs.readFileSync(jsPath, 'utf8');
                            res.writeHead(200, { 'Content-Type': 'application/javascript' });
                            res.end(jsData);
                        } else {
                            res.writeHead(404, { 'Content-Type': 'text/plain' });
                            res.end('JavaScript file not found');
                        }
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Error serving JavaScript file');
                    }
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                }
            } catch (error: any) {
                // Only send error response if headers haven't been sent yet
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end(`<h1>Authentication Error</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p>`);
                }
                server.close();
                reject(error);
            }
        });
        
        server.listen(port, async () => {
            console.error(`\nOpening authentication in your browser...`);
            console.error(`\nIf the browser doesn't open automatically, please visit:`);
            console.error(`\n${authUrl}\n`);
            
            // Open browser (platform-agnostic)
            const platform = os.platform();
            
            // Check if we're in WSL
            const isWSL = fs.existsSync('/proc/version') && 
                         fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
            
            if (isWSL) {
                // In WSL, use Windows' cmd.exe to open the browser
                exec(`cmd.exe /c start "${authUrl}"`, (error: any) => {
                    if (error) {
                        // Try PowerShell as fallback
                        exec(`powershell.exe -Command "Start-Process '${authUrl}'"`, (error2: any) => {
                            if (error2) {
                                console.error('Could not open browser automatically. Please open the URL manually.');
                            }
                        });
                    }
                });
            } else if (platform === 'darwin') {
                exec(`open "${authUrl}"`, (error: any) => {
                    if (error) {
                        console.error('Could not open browser automatically. Please open the URL manually.');
                    }
                });
            } else if (platform === 'win32') {
                exec(`cmd.exe /c start "" "${authUrl}"`, (error: any) => {
                    if (error) {
                        console.error('Could not open browser automatically. Please open the URL manually.');
                    }
                });
            } else {
                // Linux
                exec(`xdg-open "${authUrl}"`, (error: any) => {
                    if (error) {
                        // Try alternative methods
                        exec(`sensible-browser "${authUrl}"`, (error2: any) => {
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