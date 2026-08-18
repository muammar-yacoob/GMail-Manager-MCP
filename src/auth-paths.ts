/**
 * Where the OAuth client and the saved tokens live.
 *
 * Three separate functions used to re-derive these two paths inline, each with
 * its own copy of the "env var, else default" rule and its own parse of the
 * keys file. They had already drifted: one searched a list of candidate
 * directories, the others only looked at the project root. Resolution lives
 * here now so there is one answer to "which file is being read".
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const currentDir = (() => {
    try {
        return path.dirname(fileURLToPath(import.meta.url));
    } catch {
        return process.cwd();
    }
})();

/** One level up from the compiled source, where public/ and package.json sit. */
export const projectRoot = path.dirname(currentDir);

export const CONFIG_DIR = path.join(os.homedir(), '.gmail-mcp');

/** The OAuth client file this process will read. */
export function oauthKeysPath(): string {
    return process.env.GMAIL_OAUTH_PATH || path.join(projectRoot, 'gcp-oauth.keys.json');
}

/** The token file this process will read and write. */
export function credentialsPath(): string {
    return process.env.GMAIL_CREDENTIALS_PATH || path.join(CONFIG_DIR, 'credentials.json');
}

export interface OAuthKeys {
    client_id: string;
    client_secret: string;
    redirect_uris?: string[];
}

/**
 * Read the OAuth client, or null when it is not configured yet.
 *
 * Throws only when the file exists but is not a Google client file, since that
 * is a mistake worth reporting rather than a missing-setup state.
 */
export function readOAuthKeys(keysPath: string = oauthKeysPath()): OAuthKeys | null {
    if (!fs.existsSync(keysPath)) return null;

    const contents = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
    const keys = contents.installed || contents.web;
    if (!keys) {
        throw new Error('Invalid OAuth keys file format. Expected "installed" or "web" key in OAuth file.');
    }
    return keys;
}

/** Redirect URI to fall back on when the keys file does not name one. */
export const OOB_REDIRECT = 'urn:ietf:wg:oauth:2.0:oob';

/**
 * Directories searched when hunting for a misplaced keys file.
 *
 * Only used to produce a helpful error; the paths above are what actually load.
 */
export function getPossibleBasePaths(): string[] {
    const paths = [process.cwd(), currentDir, projectRoot, path.dirname(projectRoot), CONFIG_DIR];

    if (process.env.GMAIL_OAUTH_PATH) paths.unshift(path.dirname(process.env.GMAIL_OAUTH_PATH));
    if (process.env.GMAIL_CREDENTIALS_PATH) paths.unshift(path.dirname(process.env.GMAIL_CREDENTIALS_PATH));

    return [...new Set(paths)].filter(p => p && fs.existsSync(p));
}
