#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { authenticate, getCredentials } from './auth.js';
import { GmailService } from './gmail-service.js';
import { getToolDefinitions, handleToolCall } from './tools.js';
async function main() {
    const oauth2Client = await getCredentials();
    if (process.argv[2] === 'auth') {
        await authenticate(oauth2Client);
        console.log('Authentication completed successfully');
        process.exit(0);
    }
    const server = new Server({
        name: "gmail-manager",
        version: "1.0.0",
        capabilities: { tools: {} }
    });
    const gmailService = new GmailService(oauth2Client);
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getToolDefinitions() }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => await handleToolCall(gmailService, req.params.name, req.params.arguments));
    server.connect(new StdioServerTransport());
}
main().catch(e => (console.error('Server error:', e), process.exit(1)));
