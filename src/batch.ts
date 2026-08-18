/**
 * Bounded, retrying batch runner for Gmail's per-user rate limit.
 *
 * The previous implementation fired 50 requests concurrently and tallied
 * fulfilled/rejected without ever looking at *why* anything failed. Gmail's
 * per-user quota rejects roughly half of a burst that size, so a routine
 * "label these 44 messages" reported `Failed: 22` with no reason, no ids and
 * no retry. Measured against the live account: a 44-wide burst returned 20 ok
 * and 24 failures, all of them `429 rateLimitExceeded`. Run serially the very
 * same ids all succeed.
 *
 * So: cap what is in flight, back off and retry the throttled ones, and hand
 * back the reasons for anything still failing at the end.
 */

export interface BatchFailure {
    /** Human-facing identifier for the item, usually the message id. */
    item: string;
    reason: string;
}

export interface BatchResult {
    successes: number;
    failures: number;
    errors: BatchFailure[];
}

/** Status codes worth a second attempt. Anything else is a real error. */
const RETRYABLE_CODES = new Set([403, 429, 500, 502, 503, 504]);

function statusOf(err: any): number {
    return Number(err?.code ?? err?.response?.status ?? 0);
}

function isRetryable(err: any): boolean {
    const code = statusOf(err);
    if (!RETRYABLE_CODES.has(code)) return false;

    // 403 is overloaded: it covers both rate limiting and a genuine "you are
    // not allowed to do that". Retrying the latter just burns time, so only
    // the throttling variants come back for another go.
    if (code === 403) {
        const reason = err?.errors?.[0]?.reason ?? '';
        return reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded';
    }
    return true;
}

/** Flatten a googleapis error into something a human can act on. */
export function describeError(err: any): string {
    const code = statusOf(err) || '';
    const reason = err?.errors?.[0]?.reason ?? '';
    const message = err?.errors?.[0]?.message ?? err?.message ?? String(err);
    return [code, reason, message].filter(Boolean).join(' ').trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RunBatchOptions<T> {
    /** How many requests may be in flight at once. Gmail tolerates ~5 comfortably. */
    concurrency?: number;
    /** Total attempts per item, including the first. */
    maxAttempts?: number;
    /** How to name an item in the failure list. Defaults to String(item). */
    label?: (item: T) => string;
}

export async function runBatch<T>(
    items: T[],
    operation: (item: T) => Promise<unknown>,
    options: RunBatchOptions<T> = {}
): Promise<BatchResult> {
    const concurrency = options.concurrency ?? 5;
    const maxAttempts = options.maxAttempts ?? 5;
    const label = options.label ?? ((item: T) => String(item));

    let successes = 0;
    const errors: BatchFailure[] = [];
    let cursor = 0;

    const worker = async (): Promise<void> => {
        while (cursor < items.length) {
            const item = items[cursor++];
            let lastError: unknown;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    await operation(item);
                    successes++;
                    lastError = undefined;
                    break;
                } catch (err) {
                    lastError = err;
                    if (attempt === maxAttempts || !isRetryable(err)) break;
                    // Exponential backoff, plus jitter so the retries do not all
                    // wake up together and re-create the burst we just survived.
                    const backoff = Math.min(2 ** attempt * 250, 8_000);
                    await sleep(backoff + Math.random() * 250);
                }
            }

            if (lastError !== undefined) {
                errors.push({ item: label(item), reason: describeError(lastError) });
            }
        }
    };

    const workers = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: workers }, worker));

    return { successes, failures: errors.length, errors };
}

/**
 * Render a batch outcome for a tool response.
 *
 * Always says what failed and why; a bare count is what made the old behaviour
 * impossible to act on.
 */
export function formatBatchResult(verb: string, result: BatchResult): string {
    if (!result.failures) {
        return `${verb}: all ${result.successes} succeeded.`;
    }

    const tally = new Map<string, number>();
    for (const e of result.errors) tally.set(e.reason, (tally.get(e.reason) ?? 0) + 1);

    const shown = result.errors.slice(0, 20);
    const lines = [
        `${verb}: ${result.successes} succeeded, ${result.failures} failed.`,
        '',
        'Reasons:',
        ...[...tally.entries()].map(([reason, count]) => `  ${count} x ${reason}`),
        '',
        'Failed ids:',
        ...shown.map((e) => `  ${e.item}`)
    ];
    if (result.errors.length > shown.length) {
        lines.push(`  ...and ${result.errors.length - shown.length} more`);
    }
    return lines.join('\n');
}
