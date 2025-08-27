#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, InitializeRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { authenticate, getCredentials } from './auth.js';
import { GmailService } from './gmail-service.js';
import { getToolDefinitions, handleToolCall } from './tools.js';
async function main() {
    let oauth2Client = null;
    let credentialsError = null;
    try {
        oauth2Client = await getCredentials();
    }
    catch (error) {
        credentialsError = error instanceof Error ? error : new Error(String(error));
        console.log('Note: Starting server without credentials for scanning purposes. Authentication will be required for actual operations.');
    }
    if (process.argv[2] === 'auth') {
        if (!oauth2Client) {
            console.error('Error: Cannot authenticate without OAuth credentials.');
            console.error(credentialsError?.message || 'OAuth credentials not available');
            process.exit(1);
        }
        await authenticate(oauth2Client);
        console.log('Authentication completed successfully');
        process.exit(0);
    }
    const server = new Server({
        name: "gmail-manager",
        version: "1.0.4",
        capabilities: {
            tools: {}
        }
    });
    const gmailService = oauth2Client ? new GmailService(oauth2Client) : null;
    // Handle initialization properly
    server.setRequestHandler(InitializeRequestSchema, async (request) => {
        return {
            protocolVersion: "2025-06-18",
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: "gmail-manager",
                version: "1.0.4"
            },
            remote: false
        };
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getToolDefinitions() }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        if (!gmailService) {
            const errorMsg = credentialsError?.message || 'OAuth credentials not found';
            throw new Error(`Authentication required. Gmail service not available: ${errorMsg}`);
        }
        return await handleToolCall(gmailService, req.params.name, req.params.arguments);
    });
    // Use stdio transport - Smithery will handle the HTTP wrapper
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('MCP server started');
}
main().catch(e => (console.error('Server error:', e), process.exit(1)));
