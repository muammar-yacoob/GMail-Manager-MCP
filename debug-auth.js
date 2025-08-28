#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import os from 'os';
import { OAuth2Client } from 'google-auth-library';

const CONFIG_DIR = path.join(os.homedir(), '.gmail-mcp');

console.log('🔍 Gmail Auth Debugger');
console.log('='.repeat(50));

// Check for OAuth keys
const paths = [
    path.join(process.cwd(), 'gcp-oauth.keys.json'),
    path.join(CONFIG_DIR, 'gcp-oauth.keys.json'),
    process.env.GMAIL_OAUTH_PATH
].filter(Boolean);

console.log('\n📁 Checking for OAuth keys file:');
let oauthPath = null;
for (const p of paths) {
    const exists = fs.existsSync(p);
    console.log(`  ${exists ? '✅' : '❌'} ${p}`);
    if (exists && !oauthPath) oauthPath = p;
}

if (!oauthPath) {
    console.log('\n❌ No OAuth keys file found!');
    console.log('   Download from Google Cloud Console → APIs & Services → Credentials');
    process.exit(1);
}

// Check OAuth file format
console.log('\n📄 OAuth file structure:');
try {
    const content = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
    console.log(`  Type: ${content.installed ? 'Desktop' : content.web ? 'Web' : 'Unknown'}`);
    const keys = content.installed || content.web;
    if (keys) {
        console.log(`  ✅ Client ID: ${keys.client_id ? keys.client_id.substring(0, 20) + '...' : 'Missing'}`);
        console.log(`  ✅ Client Secret: ${keys.client_secret ? '***hidden***' : 'Missing'}`);
        console.log(`  ✅ Redirect URIs: ${keys.redirect_uris?.join(', ') || 'None'}`);
    } else {
        console.log('  ❌ Invalid format - missing "installed" or "web" key');
    }
} catch (error) {
    console.log(`  ❌ Error reading file: ${error.message}`);
}

// Check for existing credentials
console.log('\n🔐 Checking for saved credentials:');
const credPaths = [
    path.join(CONFIG_DIR, 'credentials.json'),
    process.env.GMAIL_CREDENTIALS_PATH
].filter(Boolean);

let hasCredentials = false;
for (const p of credPaths) {
    const exists = fs.existsSync(p);
    console.log(`  ${exists ? '✅' : '❌'} ${p}`);
    if (exists) {
        hasCredentials = true;
        try {
            const creds = JSON.parse(fs.readFileSync(p, 'utf8'));
            console.log(`     Token type: ${creds.token_type || 'Unknown'}`);
            console.log(`     Has refresh token: ${!!creds.refresh_token}`);
            console.log(`     Expiry: ${creds.expiry_date ? new Date(creds.expiry_date).toLocaleString() : 'Unknown'}`);
        } catch (e) {
            console.log(`     ⚠️ Could not parse credentials`);
        }
    }
}

if (hasCredentials) {
    console.log('\n✅ Already authenticated! Delete credentials.json to re-authenticate.');
} else {
    console.log('\n⚠️ Not authenticated yet. Run: npm run auth');
    
    // Generate auth URL
    try {
        const content = JSON.parse(fs.readFileSync(oauthPath, 'utf8'));
        const keys = content.installed || content.web;
        if (keys) {
            const oauth2Client = new OAuth2Client(
                keys.client_id, 
                keys.client_secret, 
                "http://localhost:3000/oauth2callback"
            );
            const authUrl = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.settings.basic']
            });
            console.log('\n🌐 Manual authentication URL:');
            console.log(authUrl);
            console.log('\nOpen this URL in your browser to authenticate.');
        }
    } catch (e) {
        console.log('\n❌ Could not generate auth URL:', e.message);
    }
}

console.log('\n' + '='.repeat(50));
console.log('Debug complete!');