import fs from 'fs';
import path from 'path';
import os from 'os';

export const CONFIG_DIR = path.join(os.homedir(), '.gmail-mcp');

/**
 * Find a file in multiple possible paths
 */
export function findFileInPaths(filename: string, possiblePaths: string[]): string | null {
    for (const basePath of possiblePaths) {
        if (!basePath) continue;
        
        const filePath = path.join(basePath, filename);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }
    return null;
}

/**
 * Get all possible base paths for file resolution
 */
export function getPossibleBasePaths(): string[] {
    const paths = [
        process.cwd(),
        path.dirname(__filename), // dist/
        path.dirname(path.dirname(__filename)), // project root (from dist/)
        path.dirname(path.dirname(path.dirname(__filename))), // parent of project root
        CONFIG_DIR
    ];
    
    // Add environment variable paths
    if (process.env.GMAIL_OAUTH_PATH) {
        paths.unshift(path.dirname(process.env.GMAIL_OAUTH_PATH));
    }
    if (process.env.GMAIL_CREDENTIALS_PATH) {
        paths.unshift(path.dirname(process.env.GMAIL_CREDENTIALS_PATH));
    }
    
    // Remove duplicates and non-existent paths
    return [...new Set(paths)].filter(p => p && fs.existsSync(p));
}

/**
 * Find OAuth keys file
 */
export function findOAuthKeys(): string | null {
    const possiblePaths = getPossibleBasePaths();
    return findFileInPaths('gcp-oauth.keys.json', possiblePaths);
}

/**
 * Find credentials file
 */
export function findCredentials(): string | null {
    if (process.env.GMAIL_CREDENTIALS_PATH) {
        return fs.existsSync(process.env.GMAIL_CREDENTIALS_PATH) ? process.env.GMAIL_CREDENTIALS_PATH : null;
    }
    
    const possiblePaths = getPossibleBasePaths();
    return findFileInPaths('credentials.json', possiblePaths);
}

