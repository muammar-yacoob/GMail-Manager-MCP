import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import open from 'open';

const CONFIG_DIR = path.join(os.homedir(), '.gmail-mcp');

export async function getCredentials(): Promise<OAuth2Client> {
    const localOAuthPath = path.join(process.cwd(), 'gcp-oauth.keys.json');
    const oauthPath = process.env.GMAIL_OAUTH_PATH || 
        (fs.existsSync(localOAuthPath) ? localOAuthPath : path.join(CONFIG_DIR, 'gcp-oauth.keys.json'));
    const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH || path.join(CONFIG_DIR, 'credentials.json');

    // Create config directory only if we need it (not using local file)
    if (!process.env.GMAIL_OAUTH_PATH && !fs.existsSync(localOAuthPath) && !fs.existsSync(CONFIG_DIR)) {
        try {
            fs.mkdirSync(CONFIG_DIR, { recursive: true });
        } catch (error) {
            // Ignore mkdir errors in read-only environments
        }
    }
    
    if (!fs.existsSync(oauthPath)) {
        throw new Error(`OAuth keys file not found. Checked: ${oauthPath}. Please place gcp-oauth.keys.json in project root or ${CONFIG_DIR}`);
    }
    
    const keysContent = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
    const keys = keysContent.installed || keysContent.web;
    
    if (!keys) {
        throw new Error('Invalid OAuth keys file format. Expected "installed" or "web" key in OAuth file.');
    }
    
    const oauth2Client = new OAuth2Client(keys.client_id, keys.client_secret, "http://localhost:3000/oauth2callback");
    
    if (fs.existsSync(credentialsPath)) 
        oauth2Client.setCredentials(JSON.parse(fs.readFileSync(credentialsPath, 'utf8')));
    
    return oauth2Client;
}

export async function authenticate(oauth2Client: OAuth2Client, credentialsPath?: string): Promise<void> {
    const creds = credentialsPath || path.join(CONFIG_DIR, 'credentials.json');
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
            } catch (error) {
                // Ignore browser open errors in headless environments
                console.log('Note: Could not auto-open browser. Please manually visit the URL above.');
            }
        }
        
        server.on('request', async (req, res) => {
            if (!req.url?.startsWith('/oauth2callback')) return;
            
            const code = new URL(req.url, 'http://localhost:3000').searchParams.get('code');
            
            if (!code) {
                res.writeHead(400) && res.end('No code provided');
                return reject(new Error('No code provided'));
            }
            
            try {
                const { tokens } = await oauth2Client.getToken(code);
                oauth2Client.setCredentials(tokens);
                fs.writeFileSync(creds, JSON.stringify(tokens));
                res.writeHead(200) && res.end('Authentication successful! You can close this window.');
                server.close();
                resolve();
            } catch (error) {
                res.writeHead(500) && res.end('Authentication failed');
                reject(error);
            }
        });
    });
}