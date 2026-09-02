import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { mapLimit, runBatch, type BatchResult } from './batch.js';
import { parseUnsubscribeTargets, type UnsubscribeTargets } from './unsubscribe.js';
import { sharedCache, type MailboxCache, type MailboxProbe, type SyncState } from './cache.js';

/** Enough of the common types that attachments arrive with a sensible icon. */
const MIME_BY_EXT: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.zip': 'application/zip',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

/** `~/foo` is what a user types; Node will not expand it, so do it here. */
function expandHome(filePath: string): string {
    return filePath.startsWith('~/') ? resolve(homedir(), filePath.slice(2)) : resolve(filePath);
}

/**
 * Gmail's ceiling for a whole outgoing message, attachments included.
 *
 * This is measured on the *encoded* message, not on the files as they sit on
 * disk, which is the part that catches people out: see `encodedSize`.
 */
export const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;

/**
 * What a buffer costs once it is inside a MIME message.
 *
 * base64 turns every 3 bytes into 4, and RFC 2045 line wrapping adds a CRLF
 * every 76 characters. So a 20 MB file is a little over 27 MB on the wire and
 * Gmail rejects it, despite 20 being comfortably under the advertised 25 MB
 * limit. Checking the raw size would let those through to a 400 from Google
 * whose text does not mention encoding at all.
 */
function encodedSize(bytes: number): number {
    const base64 = Math.ceil(bytes / 3) * 4;
    return base64 + Math.floor(base64 / 76) * 2;
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * The bare addresses in a header, lower-cased.
 *
 * `To:` is display-name soup — `Foo Bar <a@b.com>, c@d.com` — and comparing it
 * as a string is how a self-addressed draft slips through. Only the part inside
 * the angle brackets is the address; when there are no brackets the whole token
 * is.
 *
 * Splitting on every comma is not good enough, because a quoted display name is
 * allowed to contain one: `"Yacoob, M" <me@x.com>` is a single recipient, and
 * naive splitting turns it into two, one of which is the nonsense `"yacoob`.
 * That extra entry is enough to defeat an every()-based self-address check, so
 * commas inside quotes and inside angle brackets are stepped over.
 */
/**
 * Collapse a stacked subject line down to one prefix.
 *
 * Long threads accrete `RE: RE: External: FW: Re:` in front of the real
 * subject, one layer per hop, and every reply adds another. The words carry no
 * information beyond "this is a reply" or "this was forwarded", and they push
 * the actual subject out of the preview pane on a phone. So strip every leading
 * marker, including the localised and gateway-injected ones, then put back a
 * single `Re:` or `Fwd:` depending on what the caller is composing.
 *
 * Forwarding wins over replying when both appear, because the last thing done
 * to the message is the thing the recipient needs to know.
 */
export function tidySubject(subject: string | undefined | null, kind: 'reply' | 'forward' | 'none' = 'none'): string {
    const raw = (subject ?? '').trim();
    if (!raw) return '';

    // re / fwd / fw and their common non-English equivalents, plus the
    // `External:` and `[EXTERNAL]` banners corporate mail gateways prepend.
    const marker = /^\s*(?:\[?\s*(re|aw|sv|vs|res|odp|r|fw|fwd|wg|tr|enc|ext|external)\s*\]?\s*(?:\[\d+\])?\s*:)\s*/i;
    // Some gateways stamp "[EXTERNAL]" with no colon at all, so it needs its
    // own pattern rather than an optional colon on the one above, which would
    // then eat a bracketed word that is part of the real subject.
    const banner = /^\s*\[\s*(external|ext|extern|external sender)\s*\]\s*/i;
    const forwardish = /^(fw|fwd|wg|tr|enc)$/i;

    let core = raw;
    let sawForward = false;
    let sawReply = false;

    for (;;) {
        const b = banner.exec(core);
        if (b) { core = core.slice(b[0].length); continue; }

        const m = marker.exec(core);
        if (!m) break;
        const word = m[1].toLowerCase();
        if (forwardish.test(word)) sawForward = true;
        else if (word !== 'ext' && word !== 'external') sawReply = true;
        core = core.slice(m[0].length);
    }

    core = core.trim();

    const wanted =
        kind === 'forward' || (kind === 'none' && sawForward) ? 'Fwd: '
        : kind === 'reply' || (kind === 'none' && sawReply) ? 'Re: '
        : '';

    // A subject that was nothing but prefixes, or was empty to begin with, has
    // no core to decorate. Returning "Re: " with nothing after it is worse than
    // the bare marker, and inventing a subject for a blank one is worse still.
    if (!core) return wanted.trim();

    return wanted + core;
}

export function addressesOf(header: string | undefined | null): string[] {
    if (!header) return [];

    const parts: string[] = [];
    let current = '';
    let inQuotes = false;
    let inAngles = false;

    for (const ch of header) {
        if (ch === '"' && !inAngles) inQuotes = !inQuotes;
        else if (ch === '<' && !inQuotes) inAngles = true;
        else if (ch === '>' && !inQuotes) inAngles = false;

        if (ch === ',' && !inQuotes && !inAngles) {
            parts.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    parts.push(current);

    return parts
        .map((part) => {
            const angled = part.match(/<([^>]+)>/);
            return (angled ? angled[1] : part).trim().toLowerCase();
        })
        .filter(Boolean);
}

/**
 * Read local files into the shape `buildRaw` wants, refusing anything Gmail
 * would reject.
 *
 * The check happens here rather than at send time so the caller is told which
 * file is the problem, and told it before a large upload is attempted.
 */
export async function loadAttachments(paths: string[]): Promise<OutgoingAttachment[]> {
    const files = await Promise.all(
        paths.map(async (p) => {
            const full = expandHome(p);
            let content: Buffer;
            try {
                content = await readFile(full);
            } catch (error: any) {
                if (error?.code === 'ENOENT') throw new Error(`Attachment not found: ${full}`);
                if (error?.code === 'EISDIR') throw new Error(`Attachment is a directory, not a file: ${full}`);
                throw error;
            }
            return {
                filename: basename(full),
                mimeType: MIME_BY_EXT[extname(full).toLowerCase()] || 'application/octet-stream',
                content
            };
        })
    );

    const totalRaw = files.reduce((sum, f) => sum + f.content.length, 0);
    const totalEncoded = files.reduce((sum, f) => sum + encodedSize(f.content.length), 0);

    if (totalEncoded > MAX_MESSAGE_BYTES) {
        const breakdown = files
            .map((f) => `  ${f.filename} — ${mb(f.content.length)} on disk, ${mb(encodedSize(f.content.length))} encoded`)
            .join('\n');
        throw new Error(
            `Attachments exceed Gmail's 25 MB message limit.\n${breakdown}\n` +
                `Total: ${mb(totalRaw)} on disk, ${mb(totalEncoded)} once base64-encoded, and Gmail measures the ` +
                `encoded size. The practical ceiling is roughly ${mb(MAX_MESSAGE_BYTES * 0.73)} of actual files.\n` +
                `Upload the large ones to Drive and link them instead.`
        );
    }

    return files;
}

export interface OutgoingAttachment {
    filename: string;
    mimeType: string;
    content: Buffer;
}

export interface SendFields {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    /** Plain-text body. Always sent, even when `html` is supplied. */
    body: string;
    /** Optional HTML alternative, sent alongside the plain text. */
    html?: string;
    attachments?: OutgoingAttachment[];
    inReplyTo?: string;
    references?: string;
}

export interface EmailInfo {
    id: string;
    threadId?: string | null;
    subject: string;
    from: string;
    to: string;
    date: string;
    snippet?: string;
}

/**
 * An attachment as described by the message, with no handle for fetching it.
 *
 * The split from `AttachmentRef` is deliberate and load-bearing. Gmail mints a
 * fresh `attachmentId` on every read of a message, so an id is a token from one
 * particular fetch rather than a property of the file. Message content is
 * cached; attachment ids must never be, because a cached one would be an
 * arbitrarily old token handed out as though it were current. Keeping the id
 * off the cached shape makes that a type error rather than a bug to be found
 * later — `readEmail` cannot return one, so nothing can accidentally fetch with
 * it. `fetchMessage` is the fresh read that does produce them.
 */
export interface AttachmentSummary {
    filename: string;
    mimeType: string;
    size: number;
}

export interface AttachmentRef extends AttachmentSummary {
    attachmentId: string;
}

export interface EmailDetails extends EmailInfo {
    /** Carbon copies, needed so a reply can keep the same people in the loop. */
    cc: string;
    body: string;
    /**
     * The RFC 2822 Message-ID header, e.g. `<abc@mail.gmail.com>`.
     *
     * Distinct from `id`, which is Gmail's own opaque identifier. Only this one
     * is meaningful to the recipient's mail client, so it is what In-Reply-To
     * and References must carry.
     */
    messageIdHeader: string;
    attachments: AttachmentSummary[];
}

export interface Label {
    id?: string | null;
    name?: string | null;
    type?: string | null;
}

/**
 * A draft, described by what Gmail is actually holding.
 *
 * The recipient fields are read back from the stored message rather than
 * carried over from the request, so callers can print a To: line that is a
 * fact about the mailbox instead of a restatement of their own input.
 */
export interface DraftResult {
    id: string;
    url: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    threadId?: string;
}

/** The search-result view of a message we already hold in full. */
function summarise(details: EmailDetails): EmailInfo {
    const { id, threadId, subject, from, to, date, snippet } = details;
    return { id, threadId, subject, from, to, date, snippet };
}

export class GmailService {
    private gmail;
    /** Survives this instance: the service is rebuilt for every tool call. */
    private cache: MailboxCache;

    constructor(auth: OAuth2Client, cache: MailboxCache = sharedCache()) {
        this.gmail = google.gmail({ version: 'v1', auth });
        this.cache = cache;
    }

    /**
     * The two calls the cache uses to decide what it may still serve.
     *
     * `getProfile` costs a single quota unit and answers both "who are we" and
     * "has anything happened"; `history.list` then names exactly what changed.
     * Together they are cheaper than one `messages.get`, which is what makes
     * validating the cache on every search affordable.
     */
    private probe(): MailboxProbe {
        return {
            profile: async () => {
                const { data } = await this.gmail.users.getProfile({ userId: 'me' });
                return {
                    emailAddress: (data.emailAddress || '').toLowerCase(),
                    historyId: String(data.historyId || '')
                };
            },
            history: async (startHistoryId: string) => {
                const messageIds = new Set<string>();
                const threadIds = new Set<string>();
                let pageToken: string | undefined;

                try {
                    // Paged, but not indefinitely. A caller that has been away
                    // long enough to accumulate thousands of changes learns
                    // nothing useful from reading them all, and a partial read
                    // would be a lie about what is still valid — so give up and
                    // say so.
                    for (let page = 0; page < 10; page++) {
                        const { data } = await this.gmail.users.history.list({
                            userId: 'me',
                            startHistoryId,
                            maxResults: 500,
                            ...(pageToken ? { pageToken } : {})
                        });

                        for (const record of data.history || []) {
                            const touched = [
                                ...(record.messagesAdded || []).map((m) => m.message),
                                ...(record.messagesDeleted || []).map((m) => m.message),
                                ...(record.labelsAdded || []).map((m) => m.message),
                                ...(record.labelsRemoved || []).map((m) => m.message)
                            ];
                            for (const message of touched) {
                                if (message?.id) messageIds.add(message.id);
                                if (message?.threadId) threadIds.add(message.threadId);
                            }
                        }

                        pageToken = data.nextPageToken || undefined;
                        if (!pageToken) return { messageIds: [...messageIds], threadIds: [...threadIds] };
                    }
                    // Ran out of pages before running out of history.
                    return null;
                } catch (err: any) {
                    // Gmail answers 404 for a startHistoryId it has aged out and
                    // 400 for one it will not accept. Either way there is a gap
                    // we cannot see into, and `null` is how the cache is told to
                    // stop trusting what it holds. Anything else is transient:
                    // let it propagate, so a flaky network does not throw the
                    // whole cache away.
                    const status = Number(err?.code ?? err?.response?.status ?? 0);
                    if (status === 404 || status === 400) return null;
                    throw err;
                }
            }
        };
    }

    /**
     * Reconcile the cache with the mailbox before serving anything list-shaped.
     *
     * Never fails the caller: if the probe itself errors, the sync reports
     * "everything changed", which costs a refetch and stays correct.
     */
    private async sync(): Promise<SyncState> {
        // With caching off there is nothing to reconcile, so do not spend a
        // request establishing that.
        if (!this.cache.enabled) return { account: this.cache.account, historyId: '', unchanged: false };
        try {
            return await this.cache.sync(this.probe());
        } catch {
            // A probe that fails means "assume everything changed": the caller
            // re-fetches, which is the old behaviour, and stays correct.
            return { account: this.cache.account, historyId: '', unchanged: false };
        }
    }

    /**
     * The signed-in account's own address, used to catch self-addressed drafts.
     *
     * Held by the cache rather than by this object, because a new `GmailService`
     * is constructed for every single tool call — the old per-instance field
     * meant a `getProfile` round trip on every draft written.
     */
    async myAddress(): Promise<string> {
        if (this.cache.account) return this.cache.account;
        try {
            const { data } = await this.gmail.users.getProfile({ userId: 'me' });
            return this.cache.rememberAccount(data.emailAddress || '');
        } catch {
            return '';
        }
    }

    /**
     * Search the mailbox, re-using what has not changed.
     *
     * The shape here is the whole point of the cache, so it is worth being
     * explicit about which half is allowed to be old. The *ids* — which
     * messages match, and in what order — come from Gmail on every call where
     * anything at all has happened since the last one, so new mail, sent mail
     * and anything relabelled show up immediately. Only the per-message
     * headers and snippet are re-used, and only for ids this same call has just
     * seen Gmail return, which is safe because a delivered message's content
     * does not change.
     *
     * What that removes is the N+1: this used to cost one request per result,
     * every time. Now a repeat search over an untouched mailbox costs one
     * request in total, and a search after a couple of messages arrived costs
     * three plus one per genuinely new message.
     */
    async searchEmails(query: string, maxResults = 10): Promise<EmailInfo[]> {
        const { historyId, unchanged } = await this.sync();

        let ids = unchanged ? await this.cache.getList(query, maxResults, historyId) : undefined;
        if (!ids) {
            const { data } = await this.gmail.users.messages.list({ userId: 'me', q: query, maxResults });
            ids = (data.messages || []).map((m) => m.id!).filter(Boolean);
            await this.cache.putList(query, maxResults, historyId, ids);
        }
        if (!ids.length) return [];

        return mapLimit(ids, async (id) => {
            const summary = await this.cache.getSummary(id);
            if (summary) return summary;

            // A message read in full earlier already answers this, so a search
            // that turns up something the user has read costs nothing.
            const full = await this.cache.getMessage(id);
            if (full) return summarise(full);

            const { data: detail } = await this.gmail.users.messages.get({
                userId: 'me',
                id,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From', 'To', 'Date']
            });
            const h = detail.payload?.headers || [];
            const findHeader = (name: string) => h.find(x => x.name === name)?.value || '';
            const info: EmailInfo = {
                id,
                threadId: detail.threadId,
                subject: findHeader('Subject'),
                from: findHeader('From'),
                to: findHeader('To'),
                date: findHeader('Date'),
                snippet: detail.snippet || ''
            };
            await this.cache.putSummary(id, info);
            return info;
        });
    }
    
    /**
     * A message in full.
     *
     * Served from cache without a round trip when we have it. There is no
     * freshness question to answer: Gmail does not let the text of a delivered
     * message change, and everything about it that *can* change — labels, read
     * state, whether it is still in the inbox — is reported by the search path,
     * which always asks Gmail.
     */
    async readEmail(messageId: string): Promise<EmailDetails> {
        const cached = await this.cache.getMessage(messageId);
        if (cached) return cached;

        const { details } = await this.fetchMessage(messageId);
        return details;
    }

    /**
     * Read a message from Gmail, bypassing the cache, and keep the attachment
     * ids this particular fetch minted.
     *
     * The two callers that need this are the ones that go on to download an
     * attachment. Their ids have to come from a live read — see
     * `AttachmentSummary` for why a cached one would be worthless.
     */
    private async fetchMessage(messageId: string): Promise<{ details: EmailDetails; refs: AttachmentRef[] }> {
        const { data } = await this.gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
        const h = data.payload?.headers || [];
        const findHeader = (name: string) => h.find(x => x.name?.toLowerCase() === name.toLowerCase())?.value || '';
        const refs = this.collectAttachments(data.payload);

        const details: EmailDetails = {
            id: messageId,
            threadId: data.threadId || '',
            subject: findHeader('subject'),
            from: findHeader('from'),
            to: findHeader('to'),
            cc: findHeader('cc'),
            date: findHeader('date'),
            snippet: data.snippet || '',
            messageIdHeader: findHeader('message-id'),
            body: this.extractBody(data.payload),
            attachments: refs.map(({ filename, mimeType, size }) => ({ filename, mimeType, size }))
        };

        await this.cache.putMessage(messageId, details);
        return { details, refs };
    }

    /** Every part that is a real attachment, flattened out of the MIME tree. */
    private collectAttachments(payload: any): AttachmentRef[] {
        const found: AttachmentRef[] = [];
        const walk = (part: any) => {
            if (!part) return;
            if (part.body?.attachmentId && part.filename) {
                found.push({
                    attachmentId: part.body.attachmentId,
                    filename: part.filename,
                    mimeType: part.mimeType || 'application/octet-stream',
                    size: part.body.size || 0
                });
            }
            for (const child of part.parts || []) walk(child);
        };
        walk(payload);
        return found;
    }

    /**
     * Work out which attachment the caller means, and get a usable id for it.
     *
     * Gmail hands back a *different* attachmentId every time a message is
     * fetched. The tokens stay valid for `attachments.get` — several live ones
     * can exist at once — but they are not comparable, so looking up "the
     * attachment whose id equals the one you gave me" never matches and reports
     * a file that is plainly right there. The filename is the only stable
     * handle, so that is what selects, and the id is only ever used to fetch.
     */
    async resolveAttachment(
        messageId: string,
        selector: { filename?: string; attachmentId?: string }
    ): Promise<AttachmentRef & { subject: string; from: string }> {
        // A live read, never the cache: the ids below are only valid for the
        // fetch that produced them.
        const { details, refs } = await this.fetchMessage(messageId);
        const email = { ...details, attachments: refs };
        const context = { subject: email.subject, from: email.from };

        if (!email.attachments.length) {
            throw new Error(`Message ${messageId} has no attachments.`);
        }

        if (selector.filename) {
            const wanted = selector.filename.toLowerCase();
            const hit =
                email.attachments.find((a) => a.filename.toLowerCase() === wanted) ??
                email.attachments.find((a) => a.filename.toLowerCase().includes(wanted));
            if (!hit) {
                throw new Error(
                    `No attachment called "${selector.filename}" on message ${messageId}.\nThis message has:\n` +
                        email.attachments.map((a) => `  ${a.filename} (${a.size} bytes)`).join('\n')
                );
            }
            return { ...hit, ...context };
        }

        if (selector.attachmentId) {
            // Trust the id for fetching, but do not try to match it: take the
            // metadata from the sole attachment, or make the caller name one.
            if (email.attachments.length === 1) {
                return { ...email.attachments[0], attachmentId: selector.attachmentId, ...context };
            }
            throw new Error(
                `Message ${messageId} has ${email.attachments.length} attachments, and Gmail's attachment IDs ` +
                    `change between reads, so an ID cannot pick one out. Pass "filename" instead:\n` +
                    email.attachments.map((a) => `  ${a.filename} (${a.size} bytes)`).join('\n')
            );
        }

        if (email.attachments.length === 1) return { ...email.attachments[0], ...context };
        throw new Error(
            `Message ${messageId} has ${email.attachments.length} attachments. Pass "filename" to choose one:\n` +
                email.attachments.map((a) => `  ${a.filename} (${a.size} bytes)`).join('\n')
        );
    }

    async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
        const { data } = await this.gmail.users.messages.attachments.get({
            userId: 'me',
            messageId,
            id: attachmentId
        });
        return Buffer.from(data.data || '', 'base64url');
    }
    
    /** Save an attachment to disk and return where it landed. */
    async downloadAttachment(messageId: string, attachmentId: string, destination: string): Promise<string> {
        const full = expandHome(destination);
        await mkdir(dirname(full), { recursive: true });
        await writeFile(full, await this.getAttachment(messageId, attachmentId));
        return full;
    }

    /**
     * Every message in a conversation, oldest first.
     *
     * Reading a thread one message at a time costs a round trip each and loses
     * the ordering; this is the whole exchange in one call.
     */
    async getThread(threadId: string): Promise<EmailDetails[]> {
        // A conversation, unlike a single message, does change: a reply lands
        // in it. So this consults the history feed first, which names the
        // threads that were touched — anything it did not name is still whole.
        //
        // Before the fetch, not after, and that ordering is the whole of the
        // correctness argument. Reading the thread first and then asking for
        // the current historyId would stamp this copy with a marker from
        // *after* it was taken, so a reply landing in between would sit before
        // the cursor and never be replayed — the thread would stay stale
        // indefinitely. Establishing the cursor first is conservative: the
        // worst case is re-reading a thread that had not actually changed.
        await this.sync();
        const cached = await this.cache.getThread(threadId);
        if (cached) return cached;

        const { data } = await this.gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
        const messages = (data.messages || []).map((msg) => {
            const h = msg.payload?.headers || [];
            const findHeader = (name: string) =>
                h.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value || '';
            return {
                id: msg.id || '',
                threadId: msg.threadId || '',
                subject: findHeader('subject'),
                from: findHeader('from'),
                to: findHeader('to'),
                cc: findHeader('cc'),
                date: findHeader('date'),
                snippet: msg.snippet || '',
                messageIdHeader: findHeader('message-id'),
                body: this.extractBody(msg.payload),
                attachments: this.collectAttachments(msg.payload).map(
                    ({ filename, mimeType, size }) => ({ filename, mimeType, size })
                )
            };
        });

        await this.cache.putThread(threadId, messages);
        return messages;
    }

    /**
     * Save a message to Drafts without sending it.
     *
     * The counterpart to `sendEmail`: same fields, same attachment handling, but
     * it lands in Gmail for the user to read and send themselves. Prefer this
     * over `sendEmail` for anything the user has not explicitly asked to go out.
     */
    async createDraft(fields: SendFields & { threadId?: string }): Promise<DraftResult> {
        const raw = this.buildRaw(fields);
        const { data } = await this.gmail.users.drafts.create({
            userId: 'me',
            requestBody: { message: fields.threadId ? { raw, threadId: fields.threadId } : { raw } }
        });
        return this.describeDraft(data.id || '');
    }

    /**
     * Read a saved draft's headers back out of Gmail.
     *
     * Every draft-writing tool reports its recipients from here rather than
     * echoing the arguments it was handed. The distinction matters: echoing
     * confirms what was asked for, while this confirms what Gmail actually
     * stored and will actually send to. A reply whose recipient was derived
     * rather than supplied is precisely the case where those two differ, and
     * precisely the case where a wrong address needs to be visible before
     * anyone presses send.
     */
    async describeDraft(draftId: string): Promise<DraftResult> {
        const base = { id: draftId, url: this.getDraftUrl(draftId) };
        try {
            const { data } = await this.gmail.users.drafts.get({
                userId: 'me',
                id: draftId,
                format: 'metadata'
            });
            const h = data.message?.payload?.headers || [];
            const pick = (name: string) =>
                h.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value || '';
            return {
                ...base,
                to: pick('to'),
                cc: pick('cc') || undefined,
                bcc: pick('bcc') || undefined,
                subject: pick('subject'),
                threadId: data.message?.threadId || undefined
            };
        } catch {
            // The draft exists — it was just written. Losing the read-back is
            // not worth failing the write over, but the caller must not be told
            // a recipient that was never confirmed, so report it as unknown.
            return { ...base, to: '', subject: '' };
        }
    }

    async listDrafts(maxResults = 20): Promise<Array<{ id: string; subject: string; to: string; snippet: string; url: string }>> {
        const { data } = await this.gmail.users.drafts.list({ userId: 'me', maxResults });
        if (!data.drafts?.length) return [];

        // Drafts are never cached — they are the one thing in the mailbox the
        // user is actively editing — but the fan-out still has to be bounded,
        // or a 20-draft list is a 20-wide burst.
        return mapLimit(
            data.drafts,
            async (d) => {
                const { data: detail } = await this.gmail.users.drafts.get({
                    userId: 'me',
                    id: d.id!,
                    format: 'metadata'
                });
                const h = detail.message?.payload?.headers || [];
                const findHeader = (name: string) =>
                    h.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value || '';
                return {
                    id: d.id!,
                    subject: findHeader('subject'),
                    to: findHeader('to'),
                    snippet: detail.message?.snippet || '',
                    url: this.getDraftUrl(d.id!)
                };
            }
        );
    }

    /** Replace a draft's contents. Gmail has no partial update, so pass every field. */
    async updateDraft(draftId: string, fields: SendFields & { threadId?: string }): Promise<DraftResult> {
        const raw = this.buildRaw(fields);
        const { data } = await this.gmail.users.drafts.update({
            userId: 'me',
            id: draftId,
            requestBody: { message: fields.threadId ? { raw, threadId: fields.threadId } : { raw } }
        });
        return this.describeDraft(data.id || draftId);
    }

    /**
     * Read a draft's current contents, so update_draft can amend one field
     * without the caller having to retype the rest.
     *
     * `drafts.update` is a whole-message replace with no partial form, so
     * anything not supplied would otherwise be silently blanked.
     */
    async getDraft(draftId: string): Promise<DraftResult & { body: string; attachments: AttachmentRef[]; messageId: string }> {
        const { data } = await this.gmail.users.drafts.get({ userId: 'me', id: draftId, format: 'full' });
        const h = data.message?.payload?.headers || [];
        const pick = (name: string) => h.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value || '';

        return {
            id: draftId,
            url: this.getDraftUrl(draftId),
            to: pick('to'),
            cc: pick('cc') || undefined,
            bcc: pick('bcc') || undefined,
            subject: pick('subject'),
            threadId: data.message?.threadId || undefined,
            messageId: data.message?.id || '',
            body: this.extractBody(data.message?.payload),
            attachments: this.collectAttachments(data.message?.payload)
        };
    }

    async deleteDraft(draftId: string): Promise<void> {
        await this.gmail.users.drafts.delete({ userId: 'me', id: draftId });
    }

    /**
     * Re-download the files already attached to a draft.
     *
     * `drafts.update` replaces the entire message, so an edit that only changes
     * the body would otherwise silently strip the attachments. Gmail offers no
     * way to move a stored part into a new message, so they come down and go
     * straight back up.
     */
    async draftAttachments(draft: { messageId: string; attachments: AttachmentRef[] }): Promise<OutgoingAttachment[]> {
        return mapLimit(draft.attachments, async (a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            content: await this.getAttachment(draft.messageId, a.attachmentId)
        }));
    }

    /** Send an existing draft as-is. Delivers immediately and cannot be recalled. */
    async sendDraft(draftId: string): Promise<{ id: string; threadId: string }> {
        const { data } = await this.gmail.users.drafts.send({ userId: 'me', requestBody: { id: draftId } });
        // The draft has just become a sent message, so no recorded id list
        // describes the mailbox any more.
        await this.cache.invalidateLists();
        return { id: data.id || '', threadId: data.threadId || '' };
    }

    getDraftUrl(draftId: string): string {
        return `https://mail.google.com/mail/u/0/#drafts/${draftId}`;
    }

    async deleteEmail(id: string): Promise<void> {
        await this.gmail.users.messages.delete({ userId: 'me', id });
        await this.cache.forget([id]);
    }

    /**
     * Move a message to Trash, where it sits for 30 days before Gmail clears it.
     *
     * The recoverable counterpart to `deleteEmail`, which is immediate and
     * permanent. Inbox tidying wants this one: a mistake stays fixable.
     */
    async trashEmail(id: string): Promise<void> {
        await this.gmail.users.messages.trash({ userId: 'me', id });
        await this.cache.forget([id]);
    }

    async untrashEmail(id: string): Promise<void> {
        await this.gmail.users.messages.untrash({ userId: 'me', id });
        await this.cache.forget([id]);
    }

    async batchDeleteEmails(ids: string[]): Promise<BatchResult> {
        return runBatch(ids, (id) => this.deleteEmail(id));
    }

    async batchTrashEmails(ids: string[]): Promise<BatchResult> {
        return runBatch(ids, (id) => this.trashEmail(id));
    }

    async batchUntrashEmails(ids: string[]): Promise<BatchResult> {
        return runBatch(ids, (id) => this.untrashEmail(id));
    }
    
    /**
     * The account's labels, held briefly in memory.
     *
     * Not tied to historyId — that tracks messages, not the label list itself —
     * so this is the one genuinely time-based entry, with a short life and an
     * explicit drop whenever a label is created or deleted here. It earns its
     * place because `create_label` lists them first to avoid a 409, so every
     * "file this under X" paid for a full label list.
     */
    async listLabels(): Promise<Label[]> {
        const cached = this.cache.getLabels();
        if (cached) return cached;

        const { data } = await this.gmail.users.labels.list({ userId: 'me' });
        const labels = (data.labels || []) as Label[];
        this.cache.putLabels(labels);
        return labels;
    }
    
    async createLabel(name: string): Promise<Label> {
        const { data } = await this.gmail.users.labels.create({
            userId: 'me',
            requestBody: { name, messageListVisibility: 'show', labelListVisibility: 'labelShow' }
        });
        this.cache.forgetLabels();
        return data as Label;
    }
    
    async deleteLabel(id: string): Promise<void> {
        await this.gmail.users.labels.delete({ userId: 'me', id });
        this.cache.forgetLabels();
    }
    
    async applyLabel(messageId: string, labelId: string): Promise<void> {
        await this.modifyMessage(messageId, { addLabelIds: [labelId] });
    }
    
    async removeLabel(messageId: string, labelId: string): Promise<void> {
        await this.modifyMessage(messageId, { removeLabelIds: [labelId] });
    }
    
    async batchApplyLabels(messageIds: string[], labelIds: string[]): Promise<BatchResult> {
        return runBatch(messageIds, (id) => this.modifyMessage(id, { addLabelIds: labelIds }));
    }

    async batchRemoveLabels(messageIds: string[], labelIds: string[]): Promise<BatchResult> {
        return runBatch(messageIds, (id) => this.modifyMessage(id, { removeLabelIds: labelIds }));
    }

    /** Archive: drop INBOX but keep everything else about the message. */
    async batchArchive(messageIds: string[]): Promise<BatchResult> {
        return runBatch(messageIds, (id) => this.modifyMessage(id, { removeLabelIds: ['INBOX'] }));
    }

    async batchMarkRead(messageIds: string[], read: boolean): Promise<BatchResult> {
        const body = read ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] };
        return runBatch(messageIds, (id) => this.modifyMessage(id, body));
    }

    /**
     * Every label change goes through here, which is also where the cache is
     * told about it.
     *
     * Our own writes advance the mailbox's historyId, so the next `sync` would
     * notice anyway — but not until then, and a search fired immediately after
     * an archive must already reflect it. Dropping the affected ids here closes
     * that window rather than relying on a race.
     */
    private async modifyMessage(id: string, requestBody: any): Promise<void> {
        await this.gmail.users.messages.modify({ userId: 'me', id, requestBody });
        await this.cache.forget([id]);
    }


    getEmailUrl(messageId: string): string {
        // `#all/` rather than `#inbox/`: the id may belong to a sent, archived or
        // labelled message, and `#inbox/<id>` renders those as though they were
        // in the inbox. `#all/` resolves to wherever the message actually lives.
        return `https://mail.google.com/mail/u/0/#all/${messageId}`;
    }

    /**
     * RFC 2822 message, base64url encoded for the Gmail API.
     *
     * Subject goes out as an encoded-word whenever it is not pure ASCII, because
     * a raw UTF-8 Subject header is not legal and silently arrives as mojibake.
     */
    private buildRaw(fields: SendFields): string {
        // Every compose path lands here, so this is the one place that has to
        // normalise the subject. Idempotent: a subject already reduced to a
        // single "Re:" survives unchanged.
        fields = { ...fields, subject: tidySubject(fields.subject) };

        const encodeHeader = (value: string) =>
            /^[\x20-\x7E]*$/.test(value)
                ? value
                : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;

        // Base64 bodies must be wrapped; some MTAs reject lines over 998 chars,
        // and 76 is what RFC 2045 asks for.
        const wrap = (b64: string) => (b64.match(/.{1,76}/g) || []).join('\r\n');
        const boundary = (kind: string) => `----=_${kind}_${randomBytes(12).toString('hex')}`;

        const textPart = [
            'Content-Type: text/plain; charset="UTF-8"',
            'Content-Transfer-Encoding: base64',
            '',
            wrap(Buffer.from(fields.body, 'utf8').toString('base64'))
        ].join('\r\n');

        const htmlPart = fields.html
            ? [
                  'Content-Type: text/html; charset="UTF-8"',
                  'Content-Transfer-Encoding: base64',
                  '',
                  wrap(Buffer.from(fields.html, 'utf8').toString('base64'))
              ].join('\r\n')
            : null;

        // text alone, or text + html wrapped in multipart/alternative so clients
        // that cannot render HTML still have something to show.
        let contentType: string;
        let content: string;
        if (htmlPart) {
            const alt = boundary('ALT');
            contentType = `multipart/alternative; boundary="${alt}"`;
            content = [`--${alt}`, textPart, `--${alt}`, htmlPart, `--${alt}--`].join('\r\n');
        } else {
            contentType = 'text/plain; charset="UTF-8"';
            content = wrap(Buffer.from(fields.body, 'utf8').toString('base64'));
        }
        let transferEncoding = htmlPart ? null : 'base64';

        // Attachments push the whole thing down a level into multipart/mixed.
        const files = fields.attachments || [];
        if (files.length) {
            const mixed = boundary('MIX');
            const inner = htmlPart
                ? [`Content-Type: ${contentType}`, '', content].join('\r\n')
                : [
                      'Content-Type: text/plain; charset="UTF-8"',
                      'Content-Transfer-Encoding: base64',
                      '',
                      content
                  ].join('\r\n');

            const attachmentParts = files.map((f) =>
                [
                    `Content-Type: ${f.mimeType}; name="${f.filename}"`,
                    'Content-Transfer-Encoding: base64',
                    `Content-Disposition: attachment; filename="${f.filename}"`,
                    '',
                    wrap(f.content.toString('base64'))
                ].join('\r\n')
            );

            contentType = `multipart/mixed; boundary="${mixed}"`;
            transferEncoding = null;
            content = [
                `--${mixed}`,
                inner,
                ...attachmentParts.map((p) => `--${mixed}\r\n${p}`),
                `--${mixed}--`
            ].join('\r\n');
        }

        const headers = [
            `To: ${fields.to}`,
            fields.cc ? `Cc: ${fields.cc}` : null,
            fields.bcc ? `Bcc: ${fields.bcc}` : null,
            `Subject: ${encodeHeader(fields.subject)}`,
            fields.inReplyTo ? `In-Reply-To: ${fields.inReplyTo}` : null,
            fields.references ? `References: ${fields.references}` : null,
            'MIME-Version: 1.0',
            `Content-Type: ${contentType}`,
            transferEncoding ? `Content-Transfer-Encoding: ${transferEncoding}` : null
        ].filter(Boolean);

        const message = `${headers.join('\r\n')}\r\n\r\n${content}`;
        return Buffer.from(message, 'utf8').toString('base64url');
    }

    async sendEmail(fields: SendFields & { threadId?: string }): Promise<{ id: string; threadId: string }> {
        const raw = this.buildRaw(fields);
        const { data } = await this.gmail.users.messages.send({
            userId: 'me',
            requestBody: fields.threadId ? { raw, threadId: fields.threadId } : { raw }
        });
        // A message we just sent is new mail like any other: cached id lists
        // no longer describe the mailbox that now contains it.
        await this.cache.invalidateLists();
        return { id: data.id || '', threadId: data.threadId || '' };
    }

    /**
     * Send a fresh copy of a message that already went out.
     *
     * This is a new send, not a recall: there is no such thing over SMTP. The
     * original stays in the recipient's mailbox and this adds a second one
     * alongside it. Attachments on the original ARE carried over.
     */
    async resendEmail(
        messageId: string,
        overrides: { to?: string; cc?: string; bcc?: string; subject?: string; body?: string } = {}
    ): Promise<{ id: string; threadId: string; to: string; subject: string; attachments: number }> {
        // Live read, not the cache: the attachments are carried over by
        // downloading them, and that needs ids from this fetch.
        const { details: original, refs } = await this.fetchMessage(messageId);
        const to = overrides.to ?? original.to;
        const subject = overrides.subject ?? original.subject;
        if (!to) throw new Error(`Message ${messageId} has no To header; pass an explicit "to".`);

        const attachments = await mapLimit(refs, async (a) => ({
            filename: a.filename,
            mimeType: a.mimeType,
            content: await this.getAttachment(messageId, a.attachmentId)
        }));

        const sent = await this.sendEmail({
            to,
            cc: overrides.cc,
            bcc: overrides.bcc,
            subject,
            body: overrides.body ?? original.body,
            attachments
        });
        return { ...sent, to, subject, attachments: attachments.length };
    }
    
    /**
     * The readable body of a message.
     *
     * Two things this has to get right. Gmail returns base64**url**, so decoding
     * as plain base64 corrupts any part containing `-` or `_`. And a normal
     * message carries the same content twice, as text/plain and text/html
     * alternatives: concatenating them yields the message followed by its own
     * markup, so the plain-text side is preferred and HTML is only a fallback.
     */
    private extractBody(payload: any): string {
        const text: string[] = [];
        const html: string[] = [];

        const walk = (part: any) => {
            if (!part) return;
            // Attachments carry a filename and live behind attachmentId; they are
            // never body text.
            const isAttachment = Boolean(part.filename) && Boolean(part.body?.attachmentId);
            if (!isAttachment && part.body?.data) {
                const content = Buffer.from(part.body.data, 'base64url').toString('utf8');
                if (part.mimeType === 'text/plain') text.push(content);
                else if (part.mimeType === 'text/html') html.push(content);
            }
            for (const child of part.parts || []) walk(child);
        };
        walk(payload);

        if (text.length) return text.join('\n').trim();
        if (html.length) return this.htmlToText(html.join('\n'));
        return '';
    }

    /** Crude but adequate: enough to read an HTML-only message as prose. */
    private htmlToText(html: string): string {
        return html
            .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    /**
     * Draft a threaded reply to a message.
     *
     * The recipient rule is the interesting part. A reply normally goes to the
     * sender, but "the sender" is the account itself whenever the message being
     * replied to is one the user sent. The old behaviour resolved To: to the
     * user's own address and reported success, so the draft looked entirely
     * correct and would have gone precisely nowhere. Replying to your own sent
     * mail plainly means continuing the conversation with the people you sent it
     * to, so that is what happens, and `recipientSource` records which rule
     * fired so the caller can say so out loud.
     *
     * An explicit `to` always wins, and if neither rule can find anyone this
     * throws rather than quietly addressing the message to the user.
     */
    async createReply(
        messageId: string,
        replyMessage: string,
        overrides: {
            to?: string;
            cc?: string;
            bcc?: string;
            subject?: string;
            attachments?: OutgoingAttachment[];
        } = {}
    ): Promise<{ draft: DraftResult; recipientSource: string; selfAddressed: boolean }> {
        const email = await this.readEmail(messageId);
        const me = await this.myAddress();

        // Always rebuild the subject rather than passing the thread's own
        // through, so a subject that already reads "RE: RE: External: RE: ..."
        // comes back as a single "Re:".
        const subject = tidySubject(overrides.subject ?? email.subject, 'reply');

        let to = overrides.to;
        let cc = overrides.cc;
        let recipientSource: string;

        if (to) {
            recipientSource = 'the "to" you supplied';
        } else if (me && addressesOf(email.from).every((a) => a === me)) {
            // Replying to our own sent message: answer the people it went to.
            to = email.to;
            if (cc === undefined) cc = email.cc;
            recipientSource =
                `the original message's To header, because ${me} sent it — ` +
                `replying to its From would have addressed this draft back to you`;
            if (!to) {
                throw new Error(
                    `Message ${messageId} was sent by you (${me}) and has no To header to reply to, so there is ` +
                        `no recipient to derive. Pass an explicit "to".`
                );
            }
        } else {
            to = email.from;
            recipientSource = "the original message's From header";
            if (!to) {
                throw new Error(`Message ${messageId} has no From header to reply to. Pass an explicit "to".`);
            }
        }

        // In-Reply-To / References must carry the RFC Message-ID header, not
        // Gmail's internal id or threadId. Those mean nothing to the recipient's
        // client, so a reply built from them arrives as a new conversation
        // instead of threading under the message it answers.
        const inReplyTo = email.messageIdHeader || undefined;

        const draft = await this.createDraft({
            to,
            cc: cc || undefined,
            bcc: overrides.bcc,
            subject,
            body: replyMessage,
            attachments: overrides.attachments,
            inReplyTo,
            references: inReplyTo,
            threadId: email.threadId || undefined
        });

        // Judged on what Gmail stored, not on what we asked for.
        const stored = addressesOf(draft.to);
        const selfAddressed = Boolean(me) && stored.length > 0 && stored.every((a) => a === me);

        return { draft, recipientSource, selfAddressed };
    }

    // --- Filters -----------------------------------------------------------
    // Server-side rules. Unlike labelling a batch by hand these keep applying
    // to mail that has not arrived yet, which is what "set up a rule" means.

    async listFilters(): Promise<GmailFilter[]> {
        const { data } = await this.gmail.users.settings.filters.list({ userId: 'me' });
        return (data.filter || []) as GmailFilter[];
    }

    async createFilter(criteria: FilterCriteria, action: FilterAction): Promise<GmailFilter> {
        if (!Object.values(criteria).some((v) => v !== undefined && v !== '')) {
            throw new Error('A filter needs at least one criterion, otherwise it would match every message.');
        }
        if (!Object.values(action).some((v) => v !== undefined && (!Array.isArray(v) || v.length))) {
            throw new Error('A filter needs at least one action, otherwise it would do nothing.');
        }
        const { data } = await this.gmail.users.settings.filters.create({
            userId: 'me',
            requestBody: { criteria, action }
        });
        return data as GmailFilter;
    }

    async deleteFilter(id: string): Promise<void> {
        await this.gmail.users.settings.filters.delete({ userId: 'me', id });
    }

    /**
     * The List-Unsubscribe targets for a message, if the sender published any.
     *
     * RFC 2369 lets senders advertise a mailto: or https: opt-out, and RFC 8058
     * lets them add a List-Unsubscribe-Post header marking the https one safe to
     * fire without a human. That second header is what separates an opt-out we
     * can perform from a link we should only report, so it is fetched too.
     */
    async getUnsubscribeInfo(messageId: string): Promise<UnsubscribeTargets & { subject: string; from: string }> {
        // Reported by one tool and acted on by another, so this is normally
        // fetched twice in a row for the same message. Headers are fixed at
        // delivery, so the second read is pure waste.
        const cached = await this.cache.getUnsubscribe(messageId);
        if (cached) {
            return {
                subject: cached.subject,
                from: cached.from,
                ...parseUnsubscribeTargets(cached.listUnsubscribe, cached.listUnsubscribePost)
            };
        }

        const { data } = await this.gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'metadata',
            metadataHeaders: ['List-Unsubscribe', 'List-Unsubscribe-Post', 'Subject', 'From']
        });
        const headers = data.payload?.headers || [];
        const pick = (n: string) => headers.find((h) => h.name?.toLowerCase() === n)?.value || '';

        const entry = {
            subject: pick('subject'),
            from: pick('from'),
            listUnsubscribe: pick('list-unsubscribe'),
            listUnsubscribePost: pick('list-unsubscribe-post')
        };
        await this.cache.putUnsubscribe(messageId, entry);

        return {
            subject: entry.subject,
            from: entry.from,
            ...parseUnsubscribeTargets(entry.listUnsubscribe, entry.listUnsubscribePost)
        };
    }
}

export interface FilterCriteria {
    from?: string;
    to?: string;
    subject?: string;
    query?: string;
    negatedQuery?: string;
    hasAttachment?: boolean;
    size?: number;
    sizeComparison?: 'smaller' | 'larger';
}

export interface FilterAction {
    addLabelIds?: string[];
    removeLabelIds?: string[];
    forward?: string;
}

export interface GmailFilter {
    id?: string | null;
    criteria?: FilterCriteria;
    action?: FilterAction;
}