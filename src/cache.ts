/**
 * A cache of the mailbox that Gmail itself tells us when to invalidate.
 *
 * Reading mail through this server was quadratic in round trips for no reason:
 * `search_emails` asked Gmail for a page of ids and then fetched every one of
 * them individually, every single time, even when the same search had run
 * seconds earlier and nothing in the mailbox had moved. A 25-result search cost
 * 26 requests and ~130 units of quota, and an agent triaging an inbox runs that
 * same search over and over.
 *
 * The fix is not a timer. A TTL trades freshness for speed, and freshness is
 * the whole point of a mail tool — a cache that can hand back an inbox missing
 * the message that just arrived is worse than no cache. Gmail offers something
 * better: the mailbox carries a monotonic `historyId`, readable in one unit
 * from `users.getProfile`, and `users.history.list` replays exactly what
 * changed since any earlier value of it. So this cache is validated rather than
 * expired:
 *
 *   - Nothing has changed  (historyId identical)  -> every cached answer is
 *     provably still exact, and a search costs one request.
 *   - Something has changed -> the *list* of ids is always re-fetched from
 *     Gmail, so a new message can never be missed. Only the per-message content
 *     is reused, and only for ids Gmail has just confirmed are still there.
 *
 * That is the invariant worth stating plainly: **query results are never served
 * stale.** What the cache removes is the re-downloading of message bodies and
 * headers, which is safe because a delivered message's content is immutable —
 * Gmail lets labels change, not text. Sent and received mail are the same thing
 * here: both arrive in the history feed, so a message the user just sent shows
 * up in `in:sent` on the next search exactly as a received one shows up in
 * `in:inbox`.
 *
 * Persisted to disk so it survives the client restarting the server, which
 * happens between every session and would otherwise throw the whole thing away.
 */

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG_DIR } from './auth-paths.js';
import type { EmailDetails, EmailInfo, Label } from './gmail-service.js';

/**
 * How much of the mailbox may be kept.
 *
 * `full` persists message content to `~/.gmail-mcp/cache`, alongside the OAuth
 * token that already grants access to all of it. `memory` keeps the same cache
 * but never writes it down, so nothing outlives the process. `off` disables it
 * and every read goes to Gmail.
 */
export type CacheMode = 'full' | 'memory' | 'off';

export function cacheMode(): CacheMode {
    const raw = (process.env.GMAIL_CACHE ?? '').trim().toLowerCase();
    if (raw === 'off' || raw === 'none' || raw === '0' || raw === 'false') return 'off';
    if (raw === 'memory' || raw === 'ram') return 'memory';
    return 'full';
}

function envInt(name: string, fallback: number): number {
    const parsed = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Bumped whenever the stored shape changes, so an old file is dropped rather than misread. */
const CACHE_VERSION = 2;

const CACHE_DIR = join(CONFIG_DIR, 'cache');
const CACHE_FILE = join(CACHE_DIR, 'mailbox.json');

/**
 * A single message big enough to bloat the cache file is left uncached.
 *
 * Better to re-fetch one 5 MB newsletter than to make every save write it out
 * again.
 */
const MAX_ENTRY_BYTES = 512 * 1024;

/** How long a message's content stays cached — Gmail's own retention of the id is the real bound. */
const LABEL_TTL_MS = 5 * 60 * 1000;

interface MessageEntry {
    /** Last touched, in ms. Only used to decide what to evict. */
    at: number;
    details: EmailDetails;
}

/**
 * The header-and-snippet view a search returns.
 *
 * Kept apart from `messages` on purpose. A search fetches `format: 'metadata'`,
 * which has no body, no Cc and no attachment list; filing that under the full
 * message would make `read_email` hand back a message whose body is the empty
 * string. Two stores, each holding only what was actually fetched, is the
 * version that cannot lie.
 */
interface SummaryEntry {
    at: number;
    info: EmailInfo;
}

interface ThreadEntry {
    at: number;
    messages: EmailDetails[];
}

interface ListEntry {
    at: number;
    /** The mailbox state this id list was true for. Serving it at any other state is not allowed. */
    historyId: string;
    ids: string[];
}

/** The List-Unsubscribe headers of a message, which are as immutable as its body. */
export interface UnsubscribeEntry {
    at: number;
    subject: string;
    from: string;
    listUnsubscribe: string;
    listUnsubscribePost: string;
}

interface Persisted {
    version: number;
    /** The address these entries belong to, so a re-auth as someone else cannot serve their mail. */
    account: string;
    /** Where our replay of the history feed has reached. */
    historyId: string;
    messages: Record<string, MessageEntry>;
    summaries: Record<string, SummaryEntry>;
    threads: Record<string, ThreadEntry>;
    lists: Record<string, ListEntry>;
    unsubscribe: Record<string, UnsubscribeEntry>;
}

/** What `sync` learned about the mailbox, handed back so callers can key off it. */
export interface SyncState {
    account: string;
    historyId: string;
    /** True when Gmail's historyId was unchanged, i.e. nothing at all has happened. */
    unchanged: boolean;
}

/** The two Gmail calls the cache needs; supplied by GmailService so this module stays testable. */
export interface MailboxProbe {
    /** `users.getProfile` — one quota unit for both the address and the current historyId. */
    profile(): Promise<{ emailAddress: string; historyId: string }>;
    /**
     * `users.history.list` from a previous historyId.
     *
     * Returns the ids touched since then, or `null` when Gmail no longer holds
     * that far back — a cursor it cannot replay tells us nothing, so the caller
     * must not treat it as "no changes".
     */
    history(startHistoryId: string): Promise<{ messageIds: string[]; threadIds: string[] } | null>;
}

function emptyState(): Persisted {
    return {
        version: CACHE_VERSION,
        account: '',
        historyId: '',
        messages: {},
        summaries: {},
        threads: {},
        lists: {},
        unsubscribe: {}
    };
}

/**
 * Keep the newest `limit` entries of a record, by last touch.
 *
 * Plain LRU. The cache is a convenience, so the cheapest correct eviction is
 * the right one.
 */
function evict<T extends { at: number }>(store: Record<string, T>, limit: number): void {
    const keys = Object.keys(store);
    if (keys.length <= limit) return;
    keys.sort((a, b) => store[b].at - store[a].at);
    for (const key of keys.slice(limit)) delete store[key];
}

export class MailboxCache {
    private mode: CacheMode;
    private state: Persisted = emptyState();
    private loaded = false;
    private dirty = false;
    private saveTimer?: ReturnType<typeof setTimeout>;

    private readonly maxMessages = envInt('GMAIL_CACHE_MAX_MESSAGES', 2_000);
    private readonly maxThreads = envInt('GMAIL_CACHE_MAX_THREADS', 300);
    private readonly maxLists = envInt('GMAIL_CACHE_MAX_QUERIES', 200);

    /** Cached separately from messages: labels are account-wide and change rarely. */
    private labels?: { at: number; value: Label[] };

    constructor(mode: CacheMode = cacheMode()) {
        this.mode = mode;
    }

    get enabled(): boolean {
        return this.mode !== 'off';
    }

    /** The signed-in address, if a probe has already established it. */
    get account(): string {
        return this.state.account;
    }

    /**
     * Note whose mailbox this is, dropping everything if it is not who it was.
     *
     * Kept even when caching is off: the address is the account's identity
     * rather than its mail, and re-reading it per tool call is exactly the
     * round trip that used to be paid for every draft written.
     */
    rememberAccount(emailAddress: string): string {
        const account = (emailAddress || '').toLowerCase();
        if (!account) return this.state.account;

        if (this.state.account && account !== this.state.account) {
            // Re-authenticated as somebody else. None of this is theirs.
            this.state = emptyState();
            this.labels = undefined;
        }
        this.state.account = account;
        return account;
    }

    // --- Persistence -------------------------------------------------------

    private async load(): Promise<void> {
        if (this.loaded) return;
        this.loaded = true;
        if (this.mode !== 'full') return;

        try {
            const parsed = JSON.parse(await readFile(CACHE_FILE, 'utf8')) as Persisted;
            if (parsed?.version === CACHE_VERSION) {
                this.state = {
                    ...emptyState(),
                    ...parsed,
                    messages: parsed.messages ?? {},
                    summaries: parsed.summaries ?? {},
                    threads: parsed.threads ?? {},
                    lists: parsed.lists ?? {},
                    unsubscribe: parsed.unsubscribe ?? {}
                };
            }
        } catch {
            // No cache yet, or one we cannot read. Either way, start clean:
            // a cache is never worth failing a mail operation over.
        }
    }

    private scheduleSave(): void {
        this.dirty = true;
        if (this.mode !== 'full' || this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = undefined;
            void this.flush();
        }, 1_000);
        // Do not hold the process open just to write a cache.
        this.saveTimer.unref?.();
    }

    private evictAll(): void {
        evict(this.state.messages, this.maxMessages);
        evict(this.state.summaries, this.maxMessages);
        evict(this.state.threads, this.maxThreads);
        evict(this.state.lists, this.maxLists);
        evict(this.state.unsubscribe, this.maxMessages);
    }

    /** Write the cache out now. Failures are swallowed: this is never the point of the request. */
    async flush(): Promise<void> {
        if (this.mode !== 'full' || !this.dirty) return;
        this.dirty = false;

        this.evictAll();

        try {
            await mkdir(CACHE_DIR, { recursive: true, mode: 0o700 });
            // Written to a sibling and renamed, so a crash mid-write cannot
            // leave a half-file that the next start would have to throw away.
            const temp = `${CACHE_FILE}.${process.pid}.tmp`;
            await writeFile(temp, JSON.stringify(this.state), { mode: 0o600 });
            await rename(temp, CACHE_FILE);
        } catch {
            /* ignore */
        }
    }

    /** Last-chance synchronous write, for the exit path where promises no longer run. */
    flushSync(): void {
        if (this.mode !== 'full' || !this.dirty) return;
        this.dirty = false;
        try {
            this.evictAll();
            writeFileSync(CACHE_FILE, JSON.stringify(this.state), { mode: 0o600 });
        } catch {
            /* ignore */
        }
    }

    // --- Validation --------------------------------------------------------

    /**
     * Bring the cache into line with the mailbox, and report where it stands.
     *
     * This is the only thing standing between the cache and staleness, so it
     * runs before anything list-shaped is served. Two requests at worst: one to
     * read the current historyId, and one to ask what changed. When the answer
     * is "nothing", both cached lists and cached content are provably current.
     */
    async sync(probe: MailboxProbe): Promise<SyncState> {
        await this.load();

        const { emailAddress, historyId } = await probe.profile();
        const account = this.rememberAccount(emailAddress);

        const previous = this.state.historyId;
        if (previous && previous === historyId) {
            return { account, historyId, unchanged: true };
        }

        // Something moved. Query results are keyed by the historyId they were
        // taken at, so they simply stop matching and are re-fetched; what needs
        // deciding here is which cached *content* is still trustworthy.
        if (previous) {
            const changes = await probe.history(previous);
            if (changes) {
                // A message's text never changes, but a deleted one must stop
                // being served, and a thread that gained a reply is no longer
                // the whole conversation. Both are exactly what the feed lists.
                for (const id of changes.messageIds) {
                    delete this.state.messages[id];
                    delete this.state.summaries[id];
                }
                for (const id of changes.threadIds) delete this.state.threads[id];
            } else {
                // Gmail cannot replay from our cursor — typically the cache sat
                // unused for longer than Gmail keeps history. We have no idea
                // what happened in the gap, and guessing is how a deleted
                // message gets served as though it were still there.
                this.state.messages = {};
                this.state.summaries = {};
                this.state.threads = {};
            }
        } else {
            // No cursor to replay from, so nothing here can be vouched for.
            // Message content is immutable and survives; a conversation is not,
            // and one cached before any cursor existed — a `read_email` or a
            // `get_thread` as the first call of a session — would otherwise be
            // held forever without ever being checked for replies.
            this.state.threads = {};
        }

        this.state.historyId = historyId;
        this.state.lists = {};
        this.labels = undefined;
        this.scheduleSave();
        return { account, historyId, unchanged: false };
    }

    // --- Messages ----------------------------------------------------------

    /**
     * A message's content, if we already have it.
     *
     * Served without any round trip at all. Safe because message content is
     * immutable once delivered: everything mutable about a message — its
     * labels, whether it is in the inbox, whether it is read — is answered by
     * the search path, which always goes to Gmail.
     */
    async getMessage(id: string): Promise<EmailDetails | undefined> {
        if (!this.enabled) return undefined;
        await this.load();
        const entry = this.state.messages[id];
        if (!entry) return undefined;
        entry.at = Date.now();
        return entry.details;
    }

    async putMessage(id: string, details: EmailDetails): Promise<void> {
        if (!this.enabled) return;
        await this.load();
        if (JSON.stringify(details).length > MAX_ENTRY_BYTES) return;
        this.state.messages[id] = { at: Date.now(), details };
        this.scheduleSave();
    }

    /** The search-row view of a message, from an earlier metadata fetch. */
    async getSummary(id: string): Promise<EmailInfo | undefined> {
        if (!this.enabled) return undefined;
        await this.load();
        const entry = this.state.summaries[id];
        if (!entry) return undefined;
        entry.at = Date.now();
        return entry.info;
    }

    async putSummary(id: string, info: EmailInfo): Promise<void> {
        if (!this.enabled) return;
        await this.load();
        this.state.summaries[id] = { at: Date.now(), info };
        this.scheduleSave();
    }

    /** Everything we hold about these messages, dropped. Called after we change them ourselves. */
    async forget(ids: string[]): Promise<void> {
        if (!this.enabled) return;
        await this.load();
        for (const id of ids) {
            const threadId = this.state.messages[id]?.details.threadId;
            delete this.state.messages[id];
            delete this.state.summaries[id];
            delete this.state.unsubscribe[id];
            if (threadId) delete this.state.threads[threadId];
        }
        await this.invalidateLists();
    }

    /**
     * Forget which ids matched which query, without touching message content.
     *
     * Any write of ours — archiving, labelling, sending — makes every recorded
     * id list a description of a mailbox that no longer exists. Gmail's
     * historyId moves on too, so the next `sync` would reach the same
     * conclusion, but not until then: a search fired immediately after an
     * archive has to reflect the archive. The stored historyId is deliberately
     * left alone so that `sync` still replays the feed from where we were and
     * catches what other clients did as well.
     */
    async invalidateLists(): Promise<void> {
        if (!this.enabled) return;
        await this.load();
        this.state.lists = {};
        this.scheduleSave();
    }

    // --- Threads -----------------------------------------------------------

    async getThread(threadId: string): Promise<EmailDetails[] | undefined> {
        if (!this.enabled) return undefined;
        await this.load();
        const entry = this.state.threads[threadId];
        if (!entry) return undefined;
        entry.at = Date.now();
        return entry.messages;
    }

    async putThread(threadId: string, messages: EmailDetails[]): Promise<void> {
        if (!this.enabled) return;
        await this.load();
        if (JSON.stringify(messages).length > MAX_ENTRY_BYTES) return;
        this.state.threads[threadId] = { at: Date.now(), messages };
        // A thread read hands us every message in it, so seed those too: the
        // follow-up `read_email` on one of them is then free.
        for (const message of messages) {
            if (message.id) await this.putMessage(message.id, message);
        }
        this.scheduleSave();
    }

    // --- Query results -----------------------------------------------------

    private listKey(query: string, maxResults: number): string {
        return `${maxResults} ${query}`;
    }

    /**
     * The ids a search returned, but only if the mailbox is still in the state
     * it was in when they were recorded.
     *
     * The historyId comparison is what makes this safe rather than merely fast.
     * Any change at all — a message arriving, one being sent, a label moving —
     * advances it, and the entry stops matching.
     */
    async getList(query: string, maxResults: number, historyId: string): Promise<string[] | undefined> {
        if (!this.enabled || !historyId) return undefined;
        await this.load();
        const entry = this.state.lists[this.listKey(query, maxResults)];
        if (!entry || entry.historyId !== historyId) return undefined;
        entry.at = Date.now();
        return entry.ids;
    }

    async putList(query: string, maxResults: number, historyId: string, ids: string[]): Promise<void> {
        if (!this.enabled || !historyId) return;
        await this.load();
        this.state.lists[this.listKey(query, maxResults)] = { at: Date.now(), historyId, ids };
        this.scheduleSave();
    }

    // --- Unsubscribe headers ------------------------------------------------

    /**
     * A sender's published opt-out routes, remembered from the last read.
     *
     * `get_unsubscribe_info` and `unsubscribe_email` are designed to be called
     * one after the other — the first reports what is on offer, the second acts
     * on it — and each fetched the very same headers. They cannot change: a
     * message's headers are fixed at delivery.
     */
    async getUnsubscribe(id: string): Promise<UnsubscribeEntry | undefined> {
        if (!this.enabled) return undefined;
        await this.load();
        const entry = this.state.unsubscribe[id];
        if (!entry) return undefined;
        entry.at = Date.now();
        return entry;
    }

    async putUnsubscribe(id: string, entry: Omit<UnsubscribeEntry, 'at'>): Promise<void> {
        if (!this.enabled) return;
        await this.load();
        this.state.unsubscribe[id] = { ...entry, at: Date.now() };
        this.scheduleSave();
    }

    // --- Labels ------------------------------------------------------------

    /**
     * The label list, which is account-wide and barely ever changes.
     *
     * Not covered by historyId — that tracks messages — so this one really is
     * a short TTL, and it is dropped outright whenever a label is created or
     * deleted through this server or the mailbox moves on.
     */
    getLabels(): Label[] | undefined {
        if (!this.enabled || !this.labels) return undefined;
        if (Date.now() - this.labels.at > LABEL_TTL_MS) {
            this.labels = undefined;
            return undefined;
        }
        return this.labels.value;
    }

    putLabels(value: Label[]): void {
        if (!this.enabled) return;
        this.labels = { at: Date.now(), value };
    }

    forgetLabels(): void {
        this.labels = undefined;
    }

    /** Drop everything. Exposed for tests and for a re-auth that changes account. */
    async clear(): Promise<void> {
        await this.load();
        this.state = emptyState();
        this.labels = undefined;
        this.scheduleSave();
    }
}

/**
 * One cache for the process.
 *
 * `GmailService` is constructed fresh for every tool call, so anything held on
 * the instance is thrown away before it can be used twice — which is why the
 * account address was being re-fetched on every single request. The cache has
 * to outlive the service, and the server talks to one mailbox, so a module
 * singleton is the honest shape.
 */
let shared: MailboxCache | undefined;

export function sharedCache(): MailboxCache {
    if (!shared) {
        shared = new MailboxCache();
        const cache = shared;
        process.once('exit', () => cache.flushSync());
    }
    return shared;
}

/** Test seam: drop the singleton so a fresh one is built. */
export function resetSharedCache(): void {
    shared = undefined;
}
