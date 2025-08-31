import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { URL } from 'url';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function getAuthSuccessHTML() {
    const htmlPath = path.join(process.cwd(), 'public', 'auth-success.html');
    return fs.readFileSync(htmlPath, 'utf8');
}
function getAuthFailedHTML() {
    const htmlPath = path.join(process.cwd(), 'public', 'auth-failed.html');
    return fs.readFileSync(htmlPath, 'utf8');
}
function getAuthErrorHTML() {
    const htmlPath = path.join(process.cwd(), 'public', 'auth-error.html');
    return fs.readFileSync(htmlPath, 'utf8');
}
const CONFIG_DIR = path.join(os.homedir(), '.gmail-mcp');
function findFileInPaths(filename, possiblePaths) {
    for (const basePath of possiblePaths) {
        if (!basePath)
            continue;
        const filePath = path.join(basePath, filename);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
}
// Get all possible base paths for file resolution
function getPossibleBasePaths() {
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
function findOAuthKeys() {
    const possiblePaths = getPossibleBasePaths();
    return findFileInPaths('gcp-oauth.keys.json', possiblePaths);
}
// Find credentials file
function findCredentials() {
    if (process.env.GMAIL_CREDENTIALS_PATH) {
        return fs.existsSync(process.env.GMAIL_CREDENTIALS_PATH) ? process.env.GMAIL_CREDENTIALS_PATH : null;
    }
    const defaultPath = path.join(CONFIG_DIR, 'credentials.json');
    return fs.existsSync(defaultPath) ? defaultPath : null;
}
// Setup authentication
export async function setupAuth() {
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
        const oauth2Client = new OAuth2Client(clientConfig.client_id, clientConfig.client_secret, clientConfig.redirect_uris[0]);
        return authenticateUser(oauth2Client);
    }
    catch (error) {
        console.error('Error reading OAuth keys:', error);
        throw error;
    }
}
// Authenticate user with browser flow
async function authenticateUser(oauth2Client) {
    const scopes = ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.settings.basic'];
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, `http://${req.headers.host}`);
                if (url.pathname === '/') {
                    if (url.searchParams.has('code')) {
                        const code = url.searchParams.get('code');
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
                    }
                    else if (url.searchParams.has('error')) {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(getAuthFailedHTML());
                        server.close(() => {
                            reject(new Error('Authentication failed: ' + url.searchParams.get('error')));
                        });
                    }
                    else {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(getAuthErrorHTML());
                    }
                }
                else {
                    res.writeHead(404);
                    res.end('Not found');
                }
            }
            catch (error) {
                console.error('Error in OAuth callback:', error);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(getAuthErrorHTML());
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
                oauth2Client = new OAuth2Client(clientConfig.client_id, clientConfig.client_secret, redirectUri);
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
            const { exec } = require('child_process');
            const platform = process.platform;
            let command = '';
            if (platform === 'darwin') {
                command = `open "${authUrl}"`;
            }
            else if (platform === 'win32') {
                command = `start "" "${authUrl}"`;
            }
            else {
                command = `xdg-open "${authUrl}"`;
            }
            exec(command, (error) => {
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
export function loadCredentials() {
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
        const oauth2Client = new OAuth2Client(clientConfig.client_id, clientConfig.client_secret, clientConfig.redirect_uris[0]);
        const tokens = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        oauth2Client.setCredentials(tokens);
        return oauth2Client;
    }
    catch (error) {
        console.error('Error loading credentials:', error);
        return null;
    }
}
// Get authenticated client (load existing or setup new)
export async function getAuthenticatedClient() {
    const existingClient = loadCredentials();
    if (existingClient) {
        return existingClient;
    }
    return setupAuth();
}
// Debug authentication
export async function debugAuth() {
    console.error('=== Gmail MCP Authentication Debug ===\n');
    // Check OAuth keys
    const oauthKeysPath = findOAuthKeys();
    console.error('OAuth Keys File:');
    if (oauthKeysPath) {
        console.error(`  ✓ Found: ${oauthKeysPath}`);
        try {
            const credentials = JSON.parse(fs.readFileSync(oauthKeysPath, 'utf8'));
            const clientConfig = credentials.web || credentials.installed;
            console.error(`  ✓ Client ID: ${clientConfig.client_id.substring(0, 10)}...`);
            console.error(`  ✓ Redirect URIs: ${clientConfig.redirect_uris.length} configured`);
        }
        catch (error) {
            console.error(`  ✗ Error reading file: ${error}`);
        }
    }
    else {
        console.error('  ✗ Not found in any of these locations:');
        getPossibleBasePaths().forEach(p => console.error(`    - ${p}/gcp-oauth.keys.json`));
    }
    console.error('\nSaved Credentials:');
    const credentialsPath = findCredentials();
    if (credentialsPath) {
        console.error(`  ✓ Found: ${credentialsPath}`);
        try {
            const tokens = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            console.error(`  ✓ Access token: ${tokens.access_token ? 'Present' : 'Missing'}`);
            console.error(`  ✓ Refresh token: ${tokens.refresh_token ? 'Present' : 'Missing'}`);
            console.error(`  ✓ Expiry: ${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'Not set'}`);
        }
        catch (error) {
            console.error(`  ✗ Error reading file: ${error}`);
        }
    }
    else {
        console.error('  ✗ Not found');
    }
    console.error('\nEnvironment Variables:');
    console.error(`  GMAIL_OAUTH_PATH: ${process.env.GMAIL_OAUTH_PATH || 'Not set'}`);
    console.error(`  GMAIL_CREDENTIALS_PATH: ${process.env.GMAIL_CREDENTIALS_PATH || 'Not set'}`);
    console.error('\nTesting Authentication:');
    try {
        const client = await getAuthenticatedClient();
        console.error('  ✓ Authentication successful!');
        // Test API access
        const { google } = await import('googleapis');
        const gmail = google.gmail({ version: 'v1', auth: client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        console.error(`  ✓ Gmail API access successful for: ${profile.data.emailAddress}`);
    }
    catch (error) {
        console.error(`  ✗ Authentication failed: ${error}`);
    }
    console.error('\n=== Debug Complete ===');
}
export async function getCredentials() {
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
        }
        catch (error) {
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
        }
        catch (error) {
            // If token refresh fails, return null to force re-authentication
            return null;
        }
    }
    else {
        // No credentials file exists, return null to indicate authentication needed
        return null;
    }
    return oauth2Client;
}
export async function checkAuthStatus() {
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
            const client = await getCredentials();
            credentialsValid = client !== null;
        }
        catch {
            credentialsValid = false;
        }
    }
    return { hasOAuthKeys, hasCredentials, credentialsValid };
}
export async function getOAuthClient() {
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
export async function hasValidCredentials(oauth2Client) {
    try {
        const credentials = oauth2Client.credentials;
        if (!credentials || !credentials.refresh_token) {
            return false;
        }
        await oauth2Client.getAccessToken();
        return true;
    }
    catch {
        return false;
    }
}
export async function authenticateWeb(oauth2Client, credentialsPath) {
    const creds = credentialsPath || path.join(CONFIG_DIR, 'credentials.json');
    return new Promise((resolve, reject) => {
        let server;
        const port = 3000;
        const redirectUri = `http://localhost:${port}/oauth/callback`;
        // Create a new OAuth client with localhost redirect URI
        const webOAuth2Client = new OAuth2Client(oauth2Client._clientId, oauth2Client._clientSecret, redirectUri);
        const authUrl = webOAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.settings.basic']
        });
        server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, `http://localhost:${port}`);
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
                    }
                    else {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(getAuthFailedHTML());
                        server.close();
                        reject(new Error('No authorization code received'));
                    }
                }
                else if (url.pathname === '/') {
                    // Landing page - redirect to Google OAuth
                    res.writeHead(302, { 'Location': authUrl });
                    res.end();
                }
                else {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                }
            }
            catch (error) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end(`<h1>Authentication Error</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p>`);
                server.close();
                reject(error);
            }
        });
        server.listen(port, async () => {
            console.log(`\nOpening authentication in your browser...`);
            console.log(`\nIf the browser doesn't open automatically, please visit:`);
            console.log(`\n${authUrl}\n`);
            // Open browser (platform-agnostic)
            const { exec } = require('child_process');
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
                                console.log('Could not open browser automatically. Please open the URL manually.');
                            }
                        });
                    }
                });
            }
            else if (platform === 'darwin') {
                exec(`open "${authUrl}"`, (error) => {
                    if (error) {
                        console.log('Could not open browser automatically. Please open the URL manually.');
                    }
                });
            }
            else if (platform === 'win32') {
                exec(`cmd.exe /c start "" "${authUrl}"`, (error) => {
                    if (error) {
                        console.log('Could not open browser automatically. Please open the URL manually.');
                    }
                });
            }
            else {
                // Linux
                exec(`xdg-open "${authUrl}"`, (error) => {
                    if (error) {
                        // Try alternative methods
                        exec(`sensible-browser "${authUrl}"`, (error2) => {
                            if (error2) {
                                console.log('Could not open browser automatically. Please open the URL manually.');
                            }
                        });
                    }
                });
            }
        });
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                // Port 3000 is in use
            }
            reject(error);
        });
    });
}
