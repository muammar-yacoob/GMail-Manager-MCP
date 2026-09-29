/**
 * Reading a Google permission error for what it actually says.
 *
 * A 403 out of a Google API is not one failure, it is several wearing the same
 * status code, and the fixes do not overlap: a scope the token never carried,
 * an API switched off in the Cloud project, a sharing restriction on the
 * resource. Telling the user the wrong one is worse than telling them nothing,
 * because a plausible-sounding hint stops the investigation. So these helpers
 * only ever report what Google itself put in the response body.
 *
 * The shape varies by vintage. The legacy JSON error carries `errors[].reason`;
 * the newer google.rpc envelope carries `details[]` entries keyed by `@type`,
 * with the useful parts in `reason`, `metadata` and `links`. Both arrive on the
 * same object, so everything here reads both and does not care which is present.
 */

/** Every reason-ish string Google attached, from either error shape. */
function reasons(error: any): string[] {
    const body = error?.response?.data?.error ?? {};
    const entries = [...(error?.errors ?? []), ...(body.errors ?? []), ...(body.details ?? [])];

    return [...entries.map((e: any) => e?.reason), body.status]
        .filter((r: unknown): r is string => typeof r === 'string' && r.length > 0);
}

const messageOf = (error: any): string => String(error?.errors?.[0]?.message ?? error?.message ?? '');

/**
 * True when the API itself is disabled in the Cloud project behind the OAuth
 * client, rather than anything being wrong with the token.
 *
 * Re-running authentication against this is a round trip through the consent
 * screen that changes nothing: the grant was never the problem.
 */
export function apiDisabled(error: any): boolean {
    const found = reasons(error);
    return (
        found.includes('accessNotConfigured') ||
        found.includes('SERVICE_DISABLED') ||
        /has not been used in project|is disabled/i.test(messageOf(error))
    );
}

/**
 * True when Google says the access token's scopes do not cover this call.
 *
 * This is the one case where "re-run auth" is the honest answer, since Google
 * will not widen a refresh token it has already issued.
 */
export function scopeRefused(error: any): boolean {
    const found = reasons(error);
    return (
        found.includes('insufficientPermissions') ||
        found.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
        /insufficient (?:authentication scopes|permission)/i.test(messageOf(error))
    );
}

/**
 * The console link that turns the API back on, preferring Google's own.
 *
 * Google names the exact project in the error, and a hand-built URL cannot: an
 * OAuth client may well belong to a project the user has never looked at, so
 * the generic overview page lands them in whichever project the console happens
 * to have selected. `extendedHelp` is deliberately not consulted — it is often
 * just the console root, which is no better than the fallback.
 *
 * @param service the API's service name, e.g. `calendar-json.googleapis.com`
 */
export function activationUrl(error: any, service: string): string {
    const details: any[] = error?.response?.data?.error?.details ?? [];

    const fromMetadata = details.map(d => d?.metadata?.activationUrl).find(isConsoleUrl);
    if (fromMetadata) return fromMetadata;

    const fromLinks = details.flatMap(d => d?.links ?? []).map((l: any) => l?.url).find(isConsoleUrl);
    if (fromLinks) return fromLinks;

    // Trailing punctuation is stripped because the URL is embedded in prose:
    // "...by visiting https://... then retry."
    const fromMessage = messageOf(error).match(/https:\/\/console\.\S+/)?.[0]?.replace(/[.,)]+$/, '');
    if (isConsoleUrl(fromMessage)) return fromMessage;

    const project = messageOf(error).match(/project (\d+)/)?.[1];
    return `https://console.cloud.google.com/apis/api/${service}/overview${project ? `?project=${project}` : ''}`;
}

/** A console link is only useful if it points at something more than the root. */
function isConsoleUrl(url: unknown): url is string {
    return typeof url === 'string' && /^https:\/\/console\.(?:cloud|developers)\.google\.com\/./.test(url);
}
