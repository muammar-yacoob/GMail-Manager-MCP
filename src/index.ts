#!/usr/bin/env node

import { startGmailManagerServer } from "./lib.js";
import { setupAuth } from "./auth.js";

async function main() {
    // Check for command line authentication
    if (process.argv.includes('auth')) {
        try {
            await setupAuth();
            console.error('Authentication completed successfully!');
        } catch (error) {
            console.error('Authentication failed:', error instanceof Error ? error.message : error);
            process.exit(1);
        }
        process.exit(0);
    }
    
    // Start the MCP server
    await startGmailManagerServer();
}

main().catch(console.error);