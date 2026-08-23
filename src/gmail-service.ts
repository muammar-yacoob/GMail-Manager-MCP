import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { runBatch, type BatchResult } from './batch.js';
import { parseUnsubscribeTargets, type UnsubscribeTargets } from './unsubscribe.js';

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

export interface AttachmentRef {
    attachmentId: string;
    filename: string;
    mimeType: string;
    size: number;
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
    attachments: AttachmentRef[];
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

export class GmailService {
    private gmail;
    /** Cached for the life of the request; the address does not change under us. */
    private ownAddress?: string;

    constructor(auth: OAuth2Client) {
        this.gmail = google.gmail({ version: 'v1', auth });
    }

    /** The signed-in account's own address, used to catch self-addressed drafts. */
    async myAddress(): Promise<string> {
        if (this.ownAddress !== undefined) return this.ownAddress;
        try {
            const { data } = await this.gmail.users.getProfile({ userId: 'me' });
            this.ownAddress = (data.emailAddress || '').toLowerCase();
        } catch {
            this.ownAddress = '';
        }
        return this.ownAddress;
    }

    async searchEmails(query: string, maxResults = 10): Promise<EmailInfo[]> {
        const { data } = await this.gmail.users.messages.list({ userId: 'me', q: query, maxResults });
        if (!data.messages?.length) return [];
        
        return Promise.all(data.messages.map(async (msg) => {
            const { data: detail } = await this.gmail.users.messages.get({
                userId: 'me',
                id: msg.id!,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From', 'To', 'Date']
            });
            const h = detail.payload?.headers || [];
            const findHeader = (name: string) => h.find(x => x.name === name)?.value || '';
            return {
                id: msg.id!,
                threadId: detail.threadId,
                subject: findHeader('Subject'),
                from: findHeader('From'),
                to: findHeader('To'),
                date: findHeader('Date'),
                snippet: detail.snippet || ''
            };
        }));
    }
    
    async readEmail(messageId: string): Promise<EmailDetails> {
        const { data } = await this.gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
        const h = data.payload?.headers || [];
        const findHeader = (name: string) => h.find(x => x.name?.toLowerCase() === name.toLowerCase())?.value || '';
        
        return {
            id: messageId,
            threadId: data.threadId || '',
            subject: findHeader('subject'),
            from: findHeader('from'),
            to: findHeader('to'),
            cc: findHeader('cc'),
            date: findHeader('date'),
            messageIdHeader: findHeader('message-id'),
            body: this.extractBody(data.payload),
            attachments: this.collectAttachments(data.payload)
        };
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
        const { data } = await this.gmail.users.threads.get({ userId: 'me', id: threadId, format: 'full' });
        return (data.messages || []).map((msg) => {
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
                messageIdHeader: findHeader('message-id'),
                body: this.extractBody(msg.payload),
                attachments: this.collectAttachments(msg.payload)
            };
        });
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

        return Promise.all(
            data.drafts.map(async (d) => {
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
            })
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
        return Promise.all(
            draft.attachments.map(async (a) => ({
                filename: a.filename,
                mimeType: a.mimeType,
                content: await this.getAttachment(draft.messageId, a.attachmentId)
            }))
        );
    }

    /** Send an existing draft as-is. Delivers immediately and cannot be recalled. */
    async sendDraft(draftId: string): Promise<{ id: string; threadId: string }> {
        const { data } = await this.gmail.users.drafts.send({ userId: 'me', requestBody: { id: draftId } });
        return { id: data.id || '', threadId: data.threadId || '' };
    }

    getDraftUrl(draftId: string): string {
        return `https://mail.google.com/mail/u/0/#drafts/${draftId}`;
    }

    async deleteEmail(id: string): Promise<void> {
        await this.gmail.users.messages.delete({ userId: 'me', id });
    }

    /**
     * Move a message to Trash, where it sits for 30 days before Gmail clears it.
     *
     * The recoverable counterpart to `deleteEmail`, which is immediate and
     * permanent. Inbox tidying wants this one: a mistake stays fixable.
     */
    async trashEmail(id: string): Promise<void> {
        await this.gmail.users.messages.trash({ userId: 'me', id });
    }

    async untrashEmail(id: string): Promise<void> {
        await this.gmail.users.messages.untrash({ userId: 'me', id });
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
    
    async listLabels(): Promise<Label[]> {
        const { data } = await this.gmail.users.labels.list({ userId: 'me' });
        return (data.labels || []) as Label[];
    }
    
    async createLabel(name: string): Promise<Label> {
        const { data } = await this.gmail.users.labels.create({
            userId: 'me',
            requestBody: { name, messageListVisibility: 'show', labelListVisibility: 'labelShow' }
        });
        return data as Label;
    }
    
    async deleteLabel(id: string): Promise<void> {
        await this.gmail.users.labels.delete({ userId: 'me', id });
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

    private async modifyMessage(id: string, requestBody: any): Promise<void> {
        await this.gmail.users.messages.modify({ userId: 'me', id, requestBody });
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
        const original = await this.readEmail(messageId);
        const to = overrides.to ?? original.to;
        const subject = overrides.subject ?? original.subject;
        if (!to) throw new Error(`Message ${messageId} has no To header; pass an explicit "to".`);

        const attachments = await Promise.all(
            original.attachments.map(async (a) => ({
                filename: a.filename,
                mimeType: a.mimeType,
                content: await this.getAttachment(messageId, a.attachmentId)
            }))
        );

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

        const subject = overrides.subject
            ?? (/^re:/i.test(email.subject) ? email.subject : `Re: ${email.subject}`);

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
        const { data } = await this.gmail.users.messages.get({
            userId: 'me',
            id: messageId,
            format: 'metadata',
            metadataHeaders: ['List-Unsubscribe', 'List-Unsubscribe-Post', 'Subject', 'From']
        });
        const headers = data.payload?.headers || [];
        const pick = (n: string) => headers.find((h) => h.name?.toLowerCase() === n)?.value || '';

        return {
            subject: pick('subject'),
            from: pick('from'),
            ...parseUnsubscribeTargets(pick('list-unsubscribe'), pick('list-unsubscribe-post'))
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