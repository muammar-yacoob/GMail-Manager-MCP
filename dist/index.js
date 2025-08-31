#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, InitializeRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { getCredentials, authenticateWeb } from "./auth.js";
import { GmailService } from "./gmail-service.js";
import { getToolDefinitions, handleToolCall } from "./tools.js";
async function main() {
    let oauth2Client = null;
    let credentialsError = null;
    try {
        oauth2Client = await getCredentials();
    }
    catch (error) {
        credentialsError = error instanceof Error ? error : new Error(String(error));
    }
    // Handle command line arguments
    if (process.argv.includes('auth')) {
        if (!oauth2Client) {
            console.error('❌ OAuth credentials not configured. Please set up gcp-oauth.keys.json first.');
            process.exit(1);
        }
        await authenticateWeb(oauth2Client);
        process.exit(0);
    }
    const server = new Server({
        name: "gmail-manager",
        version: "1.1.5",
        capabilities: {
            tools: {}
        }
    });
    let gmailService = oauth2Client ? new GmailService(oauth2Client) : null;
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
        }
        catch (error) {
            console.error('Error in initialization handler:', error);
            throw error;
        }
    });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: getToolDefinitions() }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        // Handle authentication tool specially
        if (req.params.name === 'authenticate_gmail') {
            if (!oauth2Client) {
                throw new Error(`🔐 **Gmail OAuth Setup Required**

📋 **Please complete the following steps:**

1️⃣ **Create Google Cloud Project**
   • Visit: https://console.cloud.google.com/projectcreate

2️⃣ **Enable Gmail API**
   • Visit: https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics

3️⃣ **Create OAuth Credentials**
   • Visit: https://console.cloud.google.com/auth/clients
   • Choose "Desktop app" type
   • Download as \`gcp-oauth.keys.json\`

4️⃣ **Add Required Scopes**
   • Visit: https://console.cloud.google.com/auth/scopes
   • Add: \`https://www.googleapis.com/auth/gmail.modify\`
   • Add: \`https://www.googleapis.com/auth/gmail.settings.basic\`

5️⃣ **Add Test User**
   • Visit: https://console.cloud.google.com/auth/audience
   • Add your Google email as test user

6️⃣ **Restart Claude Desktop**

📍 **Current OAuth path:** ${process.env.GMAIL_OAUTH_PATH || 'not set'}`);
            }
            try {
                await authenticateWeb(oauth2Client);
                return {
                    content: [{
                            type: "text",
                            text: `🎉 **Authentication Successful!** 🎉

✅ **Gmail Manager is now connected to your Gmail account!**

🚀 **You can now use all Gmail tools:**

🔍 **Search & Filter**
• Find emails by sender, subject, date, or any Gmail query
• Use natural language to search your inbox

🗑️ **Bulk Operations**
• Delete multiple emails at once
• Clean up newsletters, spam, and old emails

🏷️ **Smart Organization**
• Create and apply labels automatically
• Organize your inbox with smart categorization

📊 **Inbox Analytics**
• Get insights about your email patterns
• Analyze storage usage and email volume

🧹 **Smart Cleanup**
• Remove unwanted emails efficiently
• Maintain inbox zero with automated cleanup

**Ready to clean your inbox? Try asking:**
• "Delete all promotional emails from the past month"
• "Find and label all bank emails as 'Finance'"
• "Clean up all unread newsletters older than 3 months"`
                        }]
                };
            }
            catch (error) {
                throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        if (!gmailService) {
            const errorMsg = credentialsError?.message || 'OAuth credentials not found';
            // Provide clear instructions for authentication with web option
            if (oauth2Client && !credentialsError?.message?.includes('OAuth credentials not found')) {
                // We have OAuth keys but no valid credentials
                throw new Error(`🔐 **Gmail Authentication Required**

✅ **OAuth keys found!** Now you need to authenticate.

🎯 **Choose one of these options:**

**Option 1 - Web Authentication (Recommended) 🌐**
• Use the \`authenticate_gmail\` tool
• Your browser will open automatically
• Complete the Google OAuth flow
• Return to Claude Desktop when done

**Option 2 - Terminal Authentication 💻**
1. Open a terminal in your project directory
2. Run: \`npm run auth\`
3. Follow the browser authentication flow
4. Restart Claude Desktop after authentication

📍 **OAuth keys found at:** ${process.env.GMAIL_OAUTH_PATH || 'project directory'}
💾 **Credentials will be saved to:** ${process.env.GMAIL_CREDENTIALS_PATH || '~/.gmail-mcp/credentials.json'}`);
            }
            else {
                // No OAuth keys found
                throw new Error(`🔐 **Gmail OAuth Setup Required**

📋 **Please complete the following steps:**

1️⃣ **Create Google Cloud Project**
   • Visit: https://console.cloud.google.com/projectcreate

2️⃣ **Enable Gmail API**
   • Visit: https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics

3️⃣ **Create OAuth Credentials**
   • Visit: https://console.cloud.google.com/auth/clients
   • Choose "Desktop app" type
   • Download as \`gcp-oauth.keys.json\`

4️⃣ **Add Required Scopes**
   • Visit: https://console.cloud.google.com/auth/scopes
   • Add: \`https://www.googleapis.com/auth/gmail.modify\`
   • Add: \`https://www.googleapis.com/auth/gmail.settings.basic\`

5️⃣ **Add Test User**
   • Visit: https://console.cloud.google.com/auth/audience
   • Add your Google email as test user

6️⃣ **Restart Claude Desktop**

📍 **Current OAuth path:** ${process.env.GMAIL_OAUTH_PATH || 'not set'}`);
            }
        }
        return await handleToolCall(gmailService, req.params.name, req.params.arguments);
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
