/**
 * The pages the local OAuth callback server serves.
 *
 * The static-asset handling below existed twice, verbatim, in two different
 * consent flows: about seventy lines of near-identical /images, /css, /data and
 * /js branches. Both copies are now this one table.
 */

import fs from 'fs';
import path from 'path';
import type { ServerResponse } from 'http';
import { projectRoot } from './auth-paths.js';

const publicDir = path.join(projectRoot, 'public');

/** Inline a sibling asset into the page, so the served HTML needs no extra requests. */
function inline(html: string, tag: string, assetPath: string, wrap: (body: string) => string): string {
    if (!fs.existsSync(assetPath)) return html;
    return html.replace(tag, wrap(fs.readFileSync(assetPath, 'utf8')));
}

export function getAuthSuccessHTML(): string {
    const commandsPath = path.join(publicDir, 'data', 'commands.json');
    let html = fs.readFileSync(path.join(publicDir, 'auth-pages', 'auth-success.html'), 'utf8');

    html = inline(html, '<link rel="stylesheet" href="/css/auth-success.css">',
        path.join(publicDir, 'css', 'auth-success.css'), css => `<style>\n${css}\n    </style>`);

    const jsPath = path.join(publicDir, 'js', 'auth-success.js');
    if (fs.existsSync(jsPath)) {
        let js = fs.readFileSync(jsPath, 'utf8');

        // The page fetches its command list at runtime. Served from a throwaway
        // localhost port that is closed moments later, that fetch is a race, so
        // the data is substituted in directly.
        if (fs.existsSync(commandsPath)) {
            const data = fs.readFileSync(commandsPath, 'utf8');
            js = js
                .replace(/const response = await fetch\('\/data\/commands\.json'\);[\s\S]*?const data = await response\.json\(\);/, `const data = ${data};`)
                .replace(/console\.log\('🔄 Loading commands from \/data\/commands\.json\.\.\.'\);/, '')
                .replace(/console\.log\('Current URL:', window\.location\.href\);/, '')
                .replace(/console\.log\('Fetch URL will be:', new URL\('\/data\/commands\.json', window\.location\.origin\)\.href\);/, '')
                .replace(/console\.log\('📡 Response received:', \{[\s\S]*?\}\);/, '')
                .replace(/if \(!response\.ok\) \{[\s\S]*?\}/, '');
        }

        html = html.replace('<script src="/js/auth-success.js"></script>', `<script>\n${js}\n    </script>`);
    }

    return html;
}

export function getAuthFailedHTML(): string {
    let html = fs.readFileSync(path.join(publicDir, 'auth-pages', 'auth-failed.html'), 'utf8');

    html = inline(html, '<link rel="stylesheet" href="/css/auth-failed.css">',
        path.join(publicDir, 'css', 'auth-failed.css'), css => `<style>\n${css}\n    </style>`);
    html = inline(html, '<script src="/js/auth-failed.js"></script>',
        path.join(publicDir, 'js', 'auth-failed.js'), js => `<script>\n${js}\n    </script>`);

    return html;
}

export function getAuthErrorHTML(): string {
    return fs.readFileSync(path.join(publicDir, 'auth-pages', 'auth-failed.html'), 'utf8');
}

/** Prefixes the callback server will serve from public/, and what they may contain. */
const SERVABLE: Record<string, { extensions: string[] | null; types: Record<string, string>; fallback: string }> = {
    '/images/': { extensions: null, types: { '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }, fallback: 'application/octet-stream' },
    '/css/': { extensions: ['.css'], types: {}, fallback: 'text/css' },
    '/data/': { extensions: ['.json'], types: {}, fallback: 'application/json' },
    '/js/': { extensions: ['.js'], types: {}, fallback: 'application/javascript' }
};

/**
 * Serve a bundled asset. Returns false when the path is not ours to handle, so
 * the caller can fall through to its own routes.
 */
export function serveStaticAsset(pathname: string, res: ServerResponse): boolean {
    const prefix = Object.keys(SERVABLE).find(p => pathname.startsWith(p));
    if (!prefix) return false;

    const rule = SERVABLE[prefix];
    const filePath = path.join(publicDir, pathname);
    const ext = path.extname(filePath).toLowerCase();

    // `public` is the only directory that may be read, whatever the URL claims.
    const allowed = filePath.startsWith(publicDir + path.sep)
        && fs.existsSync(filePath)
        && (rule.extensions === null || rule.extensions.includes(ext));

    if (!allowed) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return true;
    }

    try {
        res.writeHead(200, { 'Content-Type': rule.types[ext] ?? rule.fallback });
        res.end(fs.readFileSync(filePath));
    } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error serving file');
    }
    return true;
}
