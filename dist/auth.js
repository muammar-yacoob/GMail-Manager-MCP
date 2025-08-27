import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import open from 'open';
const CONFIG_DIR = path.join(os.homedir(), '.gmail-mcp');
const OAUTH_PATH = process.env.GMAIL_OAUTH_PATH || path.join(CONFIG_DIR, 'gcp-oauth.keys.json');
const CREDENTIALS_PATH = process.env.GMAIL_CREDENTIALS_PATH || path.join(CONFIG_DIR, 'credentials.json');
export async function getCredentials() {
    if (!process.env.GMAIL_OAUTH_PATH && !fs.existsSync(CONFIG_DIR))
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const localOAuthPath = path.join(process.cwd(), 'gcp-oauth.keys.json');
    if (fs.existsSync(localOAuthPath) && !fs.existsSync(OAUTH_PATH)) {
        fs.copyFileSync(localOAuthPath, OAUTH_PATH);
        console.log('OAuth keys found and copied to config directory.');
    }
    if (!fs.existsSync(OAUTH_PATH)) {
        console.error('Error: OAuth keys file not found. Please place gcp-oauth.keys.json in', CONFIG_DIR);
        process.exit(1);
    }
    const keysContent = JSON.parse(fs.readFileSync(OAUTH_PATH, 'utf8'));
    const keys = keysContent.installed || keysContent.web;
    if (!keys) {
        console.error('Error: Invalid OAuth keys file format.');
        process.exit(1);
    }
    const oauth2Client = new OAuth2Client(keys.client_id, keys.client_secret, "http://localhost:3000/oauth2callback");
    if (fs.existsSync(CREDENTIALS_PATH))
        oauth2Client.setCredentials(JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8')));
    return oauth2Client;
}
export async function authenticate(oauth2Client) {
    const server = http.createServer();
    server.listen(3000);
    return new Promise((resolve, reject) => {
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.settings.basic']
        });
        console.log('Please visit this URL to authenticate:', authUrl);
        // Only try to open browser if authUrl exists and not in headless environment
        if (authUrl) {
            try {
                // Skip browser opening in Docker/headless environments
                if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
                    open(authUrl);
                }
            }
            catch (error) {
                // Ignore browser open errors in headless environments
                console.log('Note: Could not auto-open browser. Please manually visit the URL above.');
            }
        }
        server.on('request', async (req, res) => {
            if (!req.url?.startsWith('/oauth2callback'))
                return;
            const code = new URL(req.url, 'http://localhost:3000').searchParams.get('code');
            if (!code) {
                res.writeHead(400) && res.end('No code provided');
                return reject(new Error('No code provided'));
            }
            try {
                const { tokens } = await oauth2Client.getToken(code);
                oauth2Client.setCredentials(tokens);
                fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(tokens));
                res.writeHead(200) && res.end('Authentication successful! You can close this window.');
                server.close();
                resolve();
            }
            catch (error) {
                res.writeHead(500) && res.end('Authentication failed');
                reject(error);
            }
        });
    });
}
