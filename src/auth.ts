import { OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';
import { SCOPES } from './scopes.js';
import { reauthCommand } from './reauth.js';
import { openBrowser } from './browser.js';
import { getAuthSuccessHTML, getAuthFailedHTML, serveStaticAsset } from './auth-pages.js';
import {
    CONFIG_DIR,
    OOB_REDIRECT,
    credentialsPath,
    getPossibleBasePaths,
    oauthKeysPath,
    readOAuthKeys
} from './auth-paths.js';

/**
 * Build an OAuth client from the configured keys file, or null when there is none.
 *
 * The redirect URI here is a placeholder: every browser flow replaces it with a
 * localhost callback on whichever port the OS hands out.
 */
export async function getOAuthClient(): Promise<OAuth2Client | null> {
    const keys = readOAuthKeys();
    if (!keys) return null;

    return new OAuth2Client(keys.client_id, keys.client_secret, keys.redirect_uris?.[0] || OOB_REDIRECT);
}

/**
 * Run the browser consent flow from a terminal.
 *
 * This is what `... auth` invokes, and it deliberately shares one implementation
 * with the in-server re-auth path. The two used to be separate flows, and the
 * terminal one had fallen behind: it wrote the token response verbatim (erasing
 * any refresh_token Google omitted) and could not open a browser under WSL.
 */
export async function setupAuth(): Promise<OAuth2Client> {
    console.error('Setting up Gmail authentication...');

    const oauth2Client = await getOAuthClient();
    if (!oauth2Client) {
        console.error(`\nError: OAuth client not found at ${oauthKeysPath()}`);
        console.error('Looked for gcp-oauth.keys.json in:');
        getPossibleBasePaths().forEach(p => console.error(`  - ${p}/gcp-oauth.keys.json`));
        console.error('\nOr set GMAIL_OAUTH_PATH to point at the file directly.');
        throw new Error('OAuth keys file not found');
    }

    await authenticateWeb(oauth2Client);
    return oauth2Client;
}

/**
 * Write tokens to disk, merged over whatever is already stored.
 *
 * Google only returns a refresh_token on the first consent, and silent refreshes
 * return an access_token alone. Writing the response verbatim therefore erased the
 * refresh_token and made the connector need a full re-auth every time.
 */
export function persistTokens(credsPath: string, tokens: Record<string, any>): void {
    try {
        const dir = path.dirname(credsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        let existing: Record<string, any> = {};
        if (fs.existsSync(credsPath)) {
            try {
                existing = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
            } catch {
                // Corrupt file - treat as empty rather than losing the new tokens
            }
        }

        const merged = { ...existing, ...tokens };
        if (!merged.refresh_token && existing.refresh_token) {
            merged.refresh_token = existing.refresh_token;
        }

        fs.writeFileSync(credsPath, JSON.stringify(merged, null, 2), { mode: 0o600 });
    } catch (error) {
        console.error(`Could not save Gmail credentials to ${credsPath}:`, error instanceof Error ? error.message : error);
    }
}

/** Load the saved tokens into a client, or null when re-authentication is needed. */
export async function getCredentials(): Promise<OAuth2Client | null> {
    const oauth2Client = await getOAuthClient();
    if (!oauth2Client) return null;

    const credsPath = credentialsPath();
    if (!fs.existsSync(credsPath)) return null;

    oauth2Client.setCredentials(JSON.parse(fs.readFileSync(credsPath, 'utf8')));

    // Write refreshed access tokens straight back to disk. Without this every
    // process start burned a refresh round-trip and the stored token stayed stale.
    oauth2Client.on('tokens', tokens => persistTokens(credsPath, tokens as Record<string, any>));

    try {
        await oauth2Client.getAccessToken();
    } catch {
        return null; // Refresh failed - the caller should re-authenticate
    }

    return oauth2Client;
}

export async function checkAuthStatus(): Promise<{ hasOAuthKeys: boolean; hasCredentials: boolean; credentialsValid: boolean }> {
    const hasOAuthKeys = fs.existsSync(oauthKeysPath());
    const hasCredentials = fs.existsSync(credentialsPath());
    let credentialsValid = false;

    if (hasOAuthKeys && hasCredentials) {
        try {
            credentialsValid = (await getCredentials()) !== null;
        } catch {
            credentialsValid = false;
        }
    }

    return { hasOAuthKeys, hasCredentials, credentialsValid };
}

export async function hasValidCredentials(oauth2Client: OAuth2Client): Promise<boolean> {
    try {
        if (!oauth2Client.credentials?.refresh_token) return false;
        await oauth2Client.getAccessToken();
        return true;
    } catch {
        return false;
    }
}

/**
 * Consent flow served from a throwaway localhost port.
 *
 * `prompt: 'consent'` is not optional here. Every caller reaches this function
 * because the stored token is unusable, and a silent re-approval returns an
 * access_token with no refresh_token - which is the state we are trying to
 * leave.
 */
export async function authenticateWeb(
    oauth2Client: OAuth2Client,
    credsPathOverride?: string,
    timeoutMs: number = Number(process.env.GMAIL_AUTH_TIMEOUT_MS) || 45_000
): Promise<void> {
    const creds = credsPathOverride || path.join(CONFIG_DIR, 'credentials.json');
    const clientId = (oauth2Client as any)._clientId;
    const clientSecret = (oauth2Client as any)._clientSecret;

    return new Promise((resolve, reject) => {
        let redirectUri = '';
        let pendingAuthUrl: string | undefined;

        /** A client bound to the callback URL, which is only known once the port is assigned. */
        const boundClient = () => new OAuth2Client(clientId, clientSecret, redirectUri);
        const authUrlFor = (client: OAuth2Client) =>
            client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });

        // Settle exactly once, always tearing down the timer and the local server.
        // Without this the promise can hang forever waiting on a browser callback
        // that never arrives, which an MCP client only ever sees as a timeout.
        let settled = false;
        let timer: NodeJS.Timeout;
        const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { server?.close(); } catch { /* already closed */ }
            error ? reject(error) : resolve();
        };

        timer = setTimeout(() => {
            finish(new Error(
                `Gmail authentication timed out after ${Math.round(timeoutMs / 1000)}s waiting for the browser callback.\n\n` +
                `This happens when the MCP server runs without a browser (headless, remote, or a background service).\n\n` +
                `Fix: run this in a terminal on the machine with your browser, then restart the client:\n` +
                `  ${reauthCommand()}\n` +
                (pendingAuthUrl ? `\nOr open this URL manually:\n  ${pendingAuthUrl}\n` : '') +
                `\nRaise the limit with GMAIL_AUTH_TIMEOUT_MS if you need longer.`
            ));
        }, timeoutMs);
        // Don't let the timer alone hold the process open.
        if (typeof timer.unref === 'function') timer.unref();

        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url!, 'http://localhost');

                if (url.pathname === '/oauth/callback') {
                    const code = url.searchParams.get('code');
                    if (!code) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end(getAuthFailedHTML());
                        finish(new Error(url.searchParams.get('error') || 'No authorization code received'));
                        return;
                    }

                    const { tokens } = await boundClient().getToken(code);
                    oauth2Client.setCredentials(tokens);
                    persistTokens(creds, tokens as Record<string, any>);

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(getAuthSuccessHTML());
                    finish();
                } else if (url.pathname === '/') {
                    res.writeHead(302, { Location: authUrlFor(boundClient()) });
                    res.end();
                } else if (!serveStaticAsset(url.pathname, res)) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                }
            } catch (error: any) {
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end(`<h1>Authentication Error</h1><p>${error instanceof Error ? error.message : 'Unknown error'}</p>`);
                }
                finish(error);
            }
        });

        server.on('error', error => finish(error));

        server.listen(0, () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                finish(new Error('Failed to start OAuth server'));
                return;
            }

            redirectUri = `http://localhost:${address.port}/oauth/callback`;
            pendingAuthUrl = authUrlFor(boundClient());

            console.error(`\nOpening authentication in your browser...`);
            console.error(`\nIf the browser doesn't open automatically, please visit:`);
            console.error(`\n${pendingAuthUrl}\n`);

            openBrowser(pendingAuthUrl);
        });
    });
}
