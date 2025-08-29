import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

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
    const localOAuthPath = path.join(process.cwd(), 'gcp-oauth.keys.json');
    const oauthPath = process.env.GMAIL_OAUTH_PATH || 
        (fs.existsSync(localOAuthPath) ? localOAuthPath : path.join(CONFIG_DIR, 'gcp-oauth.keys.json'));
    const credentialsPath = process.env.GMAIL_CREDENTIALS_PATH || path.join(CONFIG_DIR, 'credentials.json');

    const hasOAuthKeys = fs.existsSync(oauthPath);
    const hasCredentials = fs.existsSync(credentialsPath);
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

export async function authenticate(oauth2Client: OAuth2Client, credentialsPath?: string): Promise<void> {
    const creds = credentialsPath || path.join(CONFIG_DIR, 'credentials.json');
    
    // Check if we're in an interactive environment
    const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
    
    if (!isInteractive) {
        throw new Error('Authentication requires an interactive terminal. Please run this command directly in a terminal, not through MCP.');
    }
    
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.settings.basic']
    });
    
    console.log('🌐 Opening browser for Gmail authentication...');
    console.log('📋 Please grant the requested permissions');
    console.log('🔗 Visit this URL:', authUrl);
    console.log('');
    console.log('📝 After granting permission:');
    console.log('   1. You will see "Please copy this code..." or similar');
    console.log('   2. Copy the authorization code');
    console.log('   3. Paste it when prompted below');
    console.log('');
    
    // Try to open browser (only in non-containerized environments)
    try {
        const { default: open } = await import('open');
        await open(authUrl);
        console.log('✅ Browser opened automatically');
    } catch (error) {
        console.log('⚠️  Could not auto-open browser. Please manually visit the URL above.');
    }
    
    // For desktop OAuth, we need to get the authorization code from the user
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise((resolve, reject) => {
        rl.question('📋 Enter the authorization code: ', async (code) => {
            rl.close();
            
            if (!code || code.trim() === '') {
                return reject(new Error('No authorization code provided'));
            }
            
            try {
                const { tokens } = await oauth2Client.getToken(code.trim());
                oauth2Client.setCredentials(tokens);
                
                // Save credentials
                if (!fs.existsSync(path.dirname(creds))) {
                    fs.mkdirSync(path.dirname(creds), { recursive: true });
                }
                fs.writeFileSync(creds, JSON.stringify(tokens));
                
                console.log('✅ Authentication successful! Credentials saved.');
                resolve();
            } catch (tokenError) {
                reject(new Error(`Failed to exchange authorization code: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`));
            }
        });
    });
}