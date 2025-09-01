// Gmail Manager MCP Library
// This file exports the main functionality for use as a library

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getCredentials, authenticateWeb, getOAuthClient, hasValidCredentials } from "./auth.js";
import { GmailService } from "./gmail-service.js";
import { getToolDefinitions, handleToolCall } from "./tools.js";

/**
 * Create and configure the Gmail Manager MCP server
 */
export function createGmailManagerServer(): Server {
  const server = new Server({
    name: "gmail-manager",
    version: "1.1.5",
    capabilities: {
      tools: {}
    }
  });

  // Handle initialization properly
  server.setRequestHandler(InitializeRequestSchema, async (request) => {
    try {
      const response = {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "gmail-manager",
          version: "1.1.5"
        }
      };
      return response;
    } catch (error) {
      console.error('Error in initialization handler:', error);
      throw error;
    }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getToolDefinitions() }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    // Handle authentication tool specially
    if (req.params.name === 'authenticate_gmail') {
      // Always get fresh OAuth client
      let oauth2Client = await getOAuthClient();
      
      if (!oauth2Client) {
        throw new Error(`Gmail OAuth Setup Required

Please complete the following steps:

1. Create Google Cloud Project
   Visit: https://console.cloud.google.com/projectcreate

2. Enable Gmail API
   Visit: https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics

3. Create OAuth Credentials
   Visit: https://console.cloud.google.com/auth/clients
   Choose "Desktop app" type
   Download as gcp-oauth.keys.json

4. Add Required Scope
   Visit: https://console.cloud.google.com/auth/scopes
   Add: https://mail.google.com/

5. Add Test User
   Visit: https://console.cloud.google.com/auth/audience
   Add your Google email as test user

6. Save the file to project directory and restart Claude Desktop

Expected OAuth file location: ${process.env.GMAIL_OAUTH_PATH || 'project directory/gcp-oauth.keys.json'}`);
      }
      
      try {
        await authenticateWeb(oauth2Client);
        // Reinitialize Gmail service after successful authentication
        let gmailService = new GmailService(oauth2Client);
        
        return { 
          content: [{ 
            type: "text", 
            text: `Authentication Successful!

Gmail Manager is now connected to your Gmail account!

You can now use all Gmail tools:
- Search and filter emails
- Delete emails in bulk
- Create and manage labels
- Organize your inbox

Ready to start managing your inbox!` 
          }] 
        };
      } catch (error) {
        throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // For all other tools, check if we need authentication
    // Always check credentials fresh on each request
    let oauth2Client = await getCredentials();
    let gmailService = oauth2Client && await hasValidCredentials(oauth2Client) 
      ? new GmailService(oauth2Client) 
      : null;
    
    if (!gmailService) {
      // If we don't have valid credentials, get OAuth client for authentication
      oauth2Client = await getOAuthClient();
      
      if (!oauth2Client) {
        // No OAuth keys found at all
        throw new Error(`Gmail OAuth Setup Required

Please complete the following steps:

1. Create Google Cloud Project
   Visit: https://console.cloud.google.com/projectcreate

2. Enable Gmail API
   Visit: https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics

3. Create OAuth Credentials
   Visit: https://console.cloud.google.com/auth/clients
   Choose "Desktop app" type
   Download as gcp-oauth.keys.json

4. Add Required Scope
   Visit: https://console.cloud.google.com/auth/scopes
   Add: https://mail.google.com/

5. Add Test User
   Visit: https://console.cloud.google.com/auth/audience
   Add your Google email as test user

6. Save the file to project directory and restart Claude Desktop

Expected OAuth file location: ${process.env.GMAIL_OAUTH_PATH || 'project directory/gcp-oauth.keys.json'}`);
      }
      
      // We have OAuth keys but need authentication - do it automatically
      try {
        await authenticateWeb(oauth2Client);
        gmailService = new GmailService(oauth2Client);
        return await handleToolCall(gmailService, req.params.name, req.params.arguments);
      } catch (error) {
        throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}

Please try one of these alternatives:
1. Use the authenticate_gmail tool in Claude Desktop
2. Run npm run auth in terminal`);
      }
    }
    
    return await handleToolCall(gmailService!, req.params.name, req.params.arguments);
  });

  return server;
}

/**
 * Start the Gmail Manager MCP server
 */
export async function startGmailManagerServer(): Promise<void> {
  const server = createGmailManagerServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Export other useful functions
export { getCredentials, authenticateWeb, getOAuthClient, hasValidCredentials } from "./auth.js";
export { GmailService } from "./gmail-service.js";
export { getToolDefinitions, handleToolCall } from "./tools.js";
