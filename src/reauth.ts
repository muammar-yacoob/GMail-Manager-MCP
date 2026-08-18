/**
 * How to tell the user to re-run authentication.
 *
 * This is not cosmetic. `npx @spark-apps/gmail-manager-mcp@latest auth` is only
 * correct when the client actually launches the published package. Someone
 * running a local checkout (`node .../dist/index.js`) who follows that advice
 * re-consents against whatever version npm happens to be serving, which may
 * request a narrower set of scopes than the build they are running. They then
 * get the same permissions error, and no hint that they fixed nothing.
 *
 * So derive the command from how this process was actually started.
 */

/** True when the entry script came from an installed package rather than a checkout. */
function launchedFromPackage(entry: string): boolean {
    return !entry || entry.includes('node_modules') || entry.includes('/_npx/');
}

export function reauthCommand(): string {
    const entry = process.argv[1] ?? '';

    const base = launchedFromPackage(entry)
        ? 'npx @spark-apps/gmail-manager-mcp@latest auth'
        : `node ${entry} auth`;

    // Paths set in the MCP client config are not present in the user's shell, so
    // a bare command would read the wrong OAuth client. `env VAR=value cmd`
    // rather than `VAR=value cmd` because the latter is not valid fish syntax.
    const overrides = [
        ['GMAIL_OAUTH_PATH', process.env.GMAIL_OAUTH_PATH],
        ['GMAIL_CREDENTIALS_PATH', process.env.GMAIL_CREDENTIALS_PATH]
    ].filter((pair): pair is [string, string] => Boolean(pair[1]));

    if (overrides.length === 0) return base;

    return `env ${overrides.map(([k, v]) => `${k}=${v}`).join(' ')} ${base}`;
}
