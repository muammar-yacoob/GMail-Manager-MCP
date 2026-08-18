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
import { CalendarService } from "./calendar-service.js";
import { getToolDefinitions, handleToolCall, type ToolContext } from "./tools/index.js";
import { reauthCommand } from "./reauth.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Single source of truth for the reported version: package.json.
// Hardcoding it here meant `serverInfo.version` drifted (stuck at 1.3.5 while
// npm shipped 1.7.x), so clients could not tell which build they were talking to.
const SERVER_VERSION: string = (() => {
  try {
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    return JSON.parse(readFileSync(pkgPath, "utf8")).version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

/**
 * The setup walkthrough shown when no OAuth client is configured.
 *
 * Written once. It previously existed as two verbatim copies a few dozen lines
 * apart, which is exactly the kind of thing that drifts: the scope line here
 * has to match what auth actually requests, and keeping that true in two
 * places by hand is a losing game.
 */
function oauthSetupInstructions(): string {
  return `Google OAuth Setup Required

Please complete the following steps:

1. Create Google Cloud Project
   Visit: https://console.cloud.google.com/projectcreate

2. Enable the Gmail and Calendar APIs
   Gmail:    https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics
   Calendar: https://console.cloud.google.com/apis/api/calendar-json.googleapis.com/metrics

3. Create OAuth Credentials
   Visit: https://console.cloud.google.com/auth/clients
   Choose "Desktop app" type
   Download as gcp-oauth.keys.json

4. Add Required Scopes
   Visit: https://console.cloud.google.com/auth/scopes
   Add: https://mail.google.com/
   Add: https://www.googleapis.com/auth/calendar

5. Add Test User
   Visit: https://console.cloud.google.com/auth/audience
   Add your Google email as test user

6. Save the file to project directory and restart your MCP client

Expected OAuth file location: ${process.env.GMAIL_OAUTH_PATH || 'project directory/gcp-oauth.keys.json'}`;
}

/** Whether this process could realistically hand the user a browser consent screen. */
function canOpenBrowser(): boolean {
  if (process.env.GMAIL_ASSUME_BROWSER === '1') return true;
  if (process.platform === 'darwin' || process.platform === 'win32') return true;
  return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
}

const AUTH_SUCCESS_MESSAGE = `Authentication Successful!

Gmail Manager is now connected to your Google account.

Mail:     search, read, label, archive, trash, draft and send
Calendar: list, search, create, update, delete events, RSVP and find free slots

Ready to start.`;

/**
 * Create and configure the Gmail Manager MCP server
 */
export function createGmailManagerServer(): Server {
  const server = new Server({
    name: "gmail-manager",
    version: SERVER_VERSION
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Handle initialization properly
  server.setRequestHandler(InitializeRequestSchema, async (request) => {
    try {
      const response = {
        protocolVersion: request.params.protocolVersion,
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "gmail-manager",
          version: SERVER_VERSION
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
    // Credentials are re-read per request: the file on disk is the source of
    // truth, and a re-auth in another process should take effect here without
    // a restart.
    let oauth2Client = await getCredentials();
    const authed = oauth2Client && await hasValidCredentials(oauth2Client);

    if (!authed) {
      oauth2Client = await getOAuthClient();
      if (!oauth2Client) throw new Error(oauthSetupInstructions());

      // Nothing can answer the OAuth callback without a browser, so don't make the
      // caller wait out the auth timeout to be told that.
      if (!canOpenBrowser()) {
        throw new Error(`Google re-authentication required.

No browser is available in this environment, so authentication cannot complete here.

Run this in a terminal on a machine with a browser, then restart the client:
  ${reauthCommand()}`);
      }

      try {
        await authenticateWeb(oauth2Client);
      } catch (error) {
        throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}

Please try one of these alternatives:
1. Use the authenticate_gmail tool in your MCP client
2. Run npm run auth in terminal`);
      }
    }

    const ctx: ToolContext = {
      gmail: new GmailService(oauth2Client!),
      calendar: new CalendarService(oauth2Client!),
      // Supplied here rather than imported by the tool module, so the auth tool
      // is an ordinary registry entry instead of a name the dispatcher has to
      // special-case before it ever reaches the tool layer.
      authenticate: async () => {
        const client = await getOAuthClient();
        if (!client) throw new Error(oauthSetupInstructions());
        await authenticateWeb(client);
        return AUTH_SUCCESS_MESSAGE;
      }
    };

    return await handleToolCall(ctx, req.params.name, req.params.arguments);
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
export { CalendarService } from "./calendar-service.js";
export { SCOPES, hasCalendarScope } from "./scopes.js";
export { getToolDefinitions, handleToolCall } from "./tools/index.js";
