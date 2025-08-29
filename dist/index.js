#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { CallToolRequestSchema, ListToolsRequestSchema, InitializeRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { authenticate, getCredentials } from './auth.js';
import { GmailService } from './gmail-service.js';
import { getToolDefinitions, handleToolCall } from './tools.js';
import http from 'http';
import { URL } from 'url';
async function main() {
    let oauth2Client = null;
    let credentialsError = null;
    try {
        oauth2Client = await getCredentials();
    }
    catch (error) {
        credentialsError = error instanceof Error ? error : new Error(String(error));
        // Don't output any messages during normal startup - they break the MCP protocol
    }
    if (process.argv[2] === 'auth') {
        console.log('🔐 Gmail Manager - One-time Authentication Setup');
        console.log('='.repeat(50));
        if (!oauth2Client) {
            console.error('❌ Error: Cannot authenticate without OAuth credentials.');
            console.error(`   ${credentialsError?.message || 'OAuth credentials not available'}`);
            console.log('\n💡 Next steps:');
            console.log('   1. Download gcp-oauth.keys.json from Google Cloud Console');
            console.log('   2. Place it in your project directory or set GMAIL_OAUTH_PATH');
            console.log('   3. Run authentication again');
            process.exit(1);
        }
        console.log('🌐 Opening browser for Gmail authentication...');
        console.log('📝 You\'ll need to grant Gmail access permissions');
        await authenticate(oauth2Client);
        console.log('✅ Authentication completed successfully!');
        console.log('🎉 Gmail Manager is now ready to use with Claude Desktop');
        console.log('\n💾 Credentials saved for future use - no need to authenticate again');
        process.exit(0);
    }
    const server = new Server({
        name: "gmail-manager",
        version: "1.0.4",
        capabilities: {
            tools: {}
        }
    });
    let gmailService = oauth2Client ? new GmailService(oauth2Client) : null;
    // Handle initialization properly
    server.setRequestHandler(InitializeRequestSchema, async (request) => {
        try {
            const response = {
                protocolVersion: "2025-06-18",
                capabilities: {
                    tools: {}
                },
                serverInfo: {
                    name: "gmail-manager",
                    version: "1.0.9"
                }
            };
            return response;
        }
        catch (error) {
            console.error('Error in initialization handler:', error);
            throw error;
        }
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getToolDefinitions() }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        if (!gmailService) {
            // If we have OAuth keys but no credentials, try to authenticate automatically
            if (oauth2Client && !credentialsError?.message?.includes('OAuth credentials not found')) {
                try {
                    console.error('🔐 First-time authentication required. Opening browser...');
                    await authenticate(oauth2Client);
                    gmailService = new GmailService(oauth2Client);
                    return await handleToolCall(gmailService, req.params.name, req.params.arguments);
                }
                catch (authError) {
                    throw new Error(`🔐 Authentication failed: ${authError instanceof Error ? authError.message : String(authError)}`);
                }
            }
            const errorMsg = credentialsError?.message || 'OAuth credentials not found';
            throw new Error(`🔐 Authentication required. ${errorMsg}\n\n💡 Ensure your gcp-oauth.keys.json file is at the correct path: ${process.env.GMAIL_OAUTH_PATH || 'not set'}`);
        }
        return await handleToolCall(gmailService, req.params.name, req.params.arguments);
    });
    // Check if we should run in HTTP mode (for Smithery deployments) or stdio mode (for local use)
    const useHttp = process.env.PORT || process.env.USE_HTTP;
    if (useHttp) {
        // HTTP mode for Smithery container deployments
        const port = parseInt(process.env.PORT || '3000');
        let transport = null;
        const httpServer = http.createServer(async (req, res) => {
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            if (url.pathname !== '/mcp') {
                res.writeHead(404).end('Not found');
                return;
            }
            if (req.method === 'GET') {
                // Handle SSE connection establishment
                try {
                    transport = new SSEServerTransport('/mcp', res);
                    await server.connect(transport);
                }
                catch (error) {
                    res.writeHead(500).end('Failed to establish SSE connection');
                }
            }
            else if (req.method === 'POST') {
                // Handle incoming JSON-RPC messages
                if (transport && 'handleMessage' in transport) {
                    try {
                        await transport.handleMessage(req, res);
                    }
                    catch (error) {
                        res.writeHead(400).end('Failed to handle message');
                    }
                }
                else {
                    res.writeHead(500).end('SSE connection not established');
                }
            }
            else if (req.method === 'DELETE') {
                // Handle connection cleanup (optional)
                res.writeHead(200).end('OK');
            }
            else {
                res.writeHead(405).end('Method not allowed');
            }
        });
        httpServer.listen(port, () => {
            // Only log in development mode for debugging
            if (process.env.NODE_ENV !== 'production') {
                console.log(`HTTP server listening on port ${port}`);
            }
        });
    }
    else {
        // Stdio mode for local development and npm package usage
        const transport = new StdioServerTransport();
        await server.connect(transport);
    }
    // No startup messages - they break the MCP protocol
}
// Smithery stateful server export
export default async function ({ sessionId, config }) {
    // Set environment variables from config if provided
    if (config?.gcpOauthKeysPath) {
        process.env.GMAIL_OAUTH_PATH = config.gcpOauthKeysPath;
    }
    if (config?.credentialsPath) {
        process.env.GMAIL_CREDENTIALS_PATH = config.credentialsPath;
    }
    // Force HTTP mode for Smithery
    process.env.USE_HTTP = 'true';
    // Create and return server instance
    let oauth2Client = null;
    let credentialsError = null;
    try {
        oauth2Client = await getCredentials();
    }
    catch (error) {
        credentialsError = error instanceof Error ? error : new Error(String(error));
    }
    const server = new Server({
        name: "gmail-manager",
        version: "1.1.1",
        capabilities: {
            tools: {}
        }
    });
    let gmailService = oauth2Client ? new GmailService(oauth2Client) : null;
    // Handle initialization properly
    server.setRequestHandler(InitializeRequestSchema, async (request) => {
        return {
            protocolVersion: "2025-06-18",
            capabilities: {
                tools: {}
            },
            serverInfo: {
                name: "gmail-manager",
                version: "1.1.1"
            }
        };
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getToolDefinitions() }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        if (!gmailService) {
            const errorMsg = credentialsError?.message || 'OAuth credentials not found';
            throw new Error(`🔐 Authentication required. ${errorMsg}\n\n💡 Ensure your gcp-oauth.keys.json file is provided in config.`);
        }
        return await handleToolCall(gmailService, req.params.name, req.params.arguments);
    });
    return server;
}
// Also support direct execution for local development
// When the script is run directly with node, start the server
if (process.argv[1] && import.meta.url.includes('index.js')) {
    main().catch(e => {
        console.error('Server error:', e);
        process.exit(1);
    });
}
