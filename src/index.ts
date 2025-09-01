#!/usr/bin/env node

import { startGmailManagerServer } from "./lib.js";
import { getOAuthClient, authenticateWeb } from "./auth.js";

async function main() {
    // Check for command line authentication
    if (process.argv.includes('auth')) {
        const oauth2Client = await getOAuthClient();
        if (!oauth2Client) {
            console.error('OAuth credentials not configured. Please set up gcp-oauth.keys.json first.');
            process.exit(1);
        }
        
        await authenticateWeb(oauth2Client);
        process.exit(0);
    }
    
    // Start the MCP server
    await startGmailManagerServer();
}

main().catch(console.error);