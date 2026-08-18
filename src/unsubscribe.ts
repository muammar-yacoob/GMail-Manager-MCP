/**
 * Acting on a List-Unsubscribe header.
 *
 * Kept out of gmail-service.ts because none of it touches the Gmail API: it is
 * header parsing plus at most one HTTPS request, and that file is long enough.
 *
 * Everything here comes out of an email, which is to say from a stranger. The
 * sender picks the URL, the redirect target and the response body. So only the
 * mechanism the sender explicitly declared safe to automate (RFC 8058
 * one-click) is ever fired unattended, only over https, never at a private
 * address, never following a redirect, and the response body is thrown away
 * rather than handed back to the caller.
 */

export interface UnsubscribeTargets {
    /** https:// opt-out endpoint, when the sender published one. */
    url?: string;
    /** mailto: opt-out address, when the sender published one. */
    mailto?: string;
    /** Sender sent `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058). */
    oneClick: boolean;
}

/**
 * Split the two RFC 2369 / RFC 8058 headers into usable targets.
 *
 * The Post header's value is fixed by the spec, but real senders vary its
 * spacing and case, so it is normalised before comparing.
 */
export function parseUnsubscribeTargets(listUnsubscribe = '', listUnsubscribePost = ''): UnsubscribeTargets {
    const targets = [...listUnsubscribe.matchAll(/<([^>]+)>/g)].map(m => m[1].trim());

    return {
        url: targets.find(t => /^https?:/i.test(t)),
        mailto: targets.find(t => /^mailto:/i.test(t)),
        oneClick: listUnsubscribePost.replace(/\s+/g, '').toLowerCase() === 'list-unsubscribe=one-click'
    };
}

/**
 * Whether these targets can be actioned without asking anyone.
 *
 * Requires both halves of RFC 8058: the sender's One-Click declaration *and* an
 * https endpoint. A one-click flag pointing at http:// does not qualify - the
 * opt-out token would cross the wire in clear - and falls back to the other
 * routes instead.
 */
export function canOneClick(targets: UnsubscribeTargets): boolean {
    return targets.oneClick && !!targets.url && /^https:/i.test(targets.url);
}

export interface MailtoUnsubscribe {
    to: string;
    subject: string;
    body: string;
}

/**
 * Split a mailto: opt-out into the fields needed to send it.
 *
 * The address on its own is not enough. Senders routinely carry the
 * subscription token in the query - `mailto:leave@x.com?subject=unsub-9f3a` -
 * and a message sent without it identifies no subscription, so the opt-out
 * quietly does nothing while looking like it worked.
 */
export function parseMailto(uri: string): MailtoUnsubscribe {
    const [address, query = ''] = uri.replace(/^mailto:/i, '').split('?');
    const params = new URLSearchParams(query);

    // A sender can write "%ZZ" here, which throws rather than decoding. The raw
    // address is the better answer then: the send will fail loudly on a bad one.
    let to = address;
    try { to = decodeURIComponent(address); } catch { /* keep it as written */ }

    return {
        to,
        subject: params.get('subject') || 'unsubscribe',
        body: params.get('body') || 'Please unsubscribe this address from your mailing list.'
    };
}

/** Hostnames that resolve somewhere on this machine or this network. */
const LOCAL_SUFFIX = /^(localhost|.*\.(local|internal|localhost|home\.arpa))$/i;

/**
 * Whether a hostname points inside the network rather than out at the internet.
 *
 * A hostile sender can put anything in List-Unsubscribe, including the address
 * of a router or a metadata endpoint, and this process sits behind whatever
 * firewall the user does. Only literal addresses are caught here - resolving
 * names to check them would be a DNS-rebinding race, not a fix - which covers
 * the direct attempt and leaves the rest to the network.
 */
export function isPrivateHost(hostname: string): boolean {
    if (LOCAL_SUFFIX.test(hostname)) return true;

    const v4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (v4) {
        const [a, b] = v4.slice(1, 3).map(Number);
        return a === 0 || a === 10 || a === 127
            || (a === 169 && b === 254)           // link-local, incl. cloud metadata
            || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 168)
            || (a === 100 && b >= 64 && b <= 127); // carrier-grade NAT
    }

    // Any IPv6 literal at all, which URL.hostname hands over in brackets. Listing
    // the private ranges the way the v4 check does would be default-allow, and
    // v6 has too many ways to write the same address for that to hold: `::`,
    // `::ffff:127.0.0.1` and `::ffff:7f00:1` are all loopback in different
    // clothes. A mailing list publishes a hostname, so refuse the whole form.
    return /^\[|:/.test(hostname);
}

/** Parse and vet an opt-out URL, or explain why it will not be requested. */
export function assertPostable(rawUrl: string): URL {
    let url: URL;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error(`The sender's unsubscribe target is not a valid URL: ${rawUrl}`);
    }

    if (url.protocol !== 'https:') {
        throw new Error(`Refusing to send the opt-out over ${url.protocol}// - one-click unsubscribe requires https.`);
    }
    if (isPrivateHost(url.hostname)) {
        throw new Error(`Refusing to request a private address (${url.hostname}). A mailing list's opt-out endpoint should be on the public internet.`);
    }

    return url;
}

/** The slice of fetch this module uses, so tests can supply their own. */
export type FetchLike = (url: string, init: Record<string, unknown>) => Promise<{ status: number }>;

export interface OneClickResult {
    status: number;
    ok: boolean;
}

/**
 * Perform the RFC 8058 one-click POST.
 *
 * Returns the status and nothing else. The response body is deliberately never
 * read: it is text written by the sender, and the caller here is a language
 * model, so putting it in the reply would let any mailing list write directly
 * into the conversation.
 */
export async function oneClickUnsubscribe(
    rawUrl: string,
    fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
    timeoutMs = 10_000
): Promise<OneClickResult> {
    const url = assertPostable(rawUrl);

    const response = await fetchImpl(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
        // A redirect would land on a host assertPostable never saw. Treat the
        // 3xx as the final answer instead of chasing it.
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs)
    });

    return { status: response.status, ok: response.status >= 200 && response.status < 400 };
}
