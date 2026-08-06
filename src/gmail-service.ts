import { randomBytes } from 'node:crypto';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

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

export class GmailService {
    private gmail;
    
    constructor(auth: OAuth2Client) {
        this.gmail = google.gmail({ version: 'v1', auth });
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
    
    async deleteEmail(id: string): Promise<void> {
        await this.gmail.users.messages.delete({ userId: 'me', id });
    }
    
    async batchDeleteEmails(ids: string[]): Promise<{ successes: number; failures: number }> {
        return this.batchOperation(ids, (id) => this.deleteEmail(id));
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
    
    async batchApplyLabels(messageIds: string[], labelIds: string[]): Promise<{ successes: number; failures: number }> {
        return this.batchOperation(messageIds, (id) => this.modifyMessage(id, { addLabelIds: labelIds }));
    }
    
    private async modifyMessage(id: string, requestBody: any): Promise<void> {
        await this.gmail.users.messages.modify({ userId: 'me', id, requestBody });
    }
    
    private async batchOperation<T>(items: T[], operation: (item: T) => Promise<any>): Promise<{ successes: number; failures: number }> {
        let successes = 0, failures = 0;
        const batchSize = 50;
        
        for (let i = 0; i < items.length; i += batchSize) {
            const results = await Promise.allSettled(items.slice(i, i + batchSize).map(operation));
            results.forEach(r => r.status === 'fulfilled' ? successes++ : failures++);
        }
        
        return { successes, failures };
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
    
    private extractBody(payload: any): string {
        if (!payload) return '';
        let text = '', html = '';
        
        if (payload.body?.data) {
            const content = Buffer.from(payload.body.data, 'base64').toString('utf8');
            if (payload.mimeType === 'text/plain') text = content;
            else if (payload.mimeType === 'text/html') html = content;
        }
        
        if (payload.parts) {
            for (const part of payload.parts) {
                const extracted = this.extractBody(part);
                if (extracted) text = text ? `${text}\n${extracted}` : extracted;
            }
        }
        
        return text || html || '';
    }

    async createReply(messageId: string, replyMessage: string): Promise<{message: string, to: string, subject: string, replyMessage: string}> {
        const email = await this.readEmail(messageId);

        // Create email message for draft
        const subject = email.subject.startsWith('Re: ') ? email.subject : `Re: ${email.subject}`;
        const to = email.from;
        // In-Reply-To / References must carry the RFC Message-ID header, not
        // Gmail's internal id or threadId. Those mean nothing to the recipient's
        // client, so a reply built from them arrives as a new conversation
        // instead of threading under the message it answers.
        const inReplyTo = email.messageIdHeader || undefined;

        const encodedMessage = this.buildRaw({
            to,
            subject,
            body: replyMessage,
            inReplyTo,
            references: inReplyTo
        });

        try {
            const { data: draft } = await this.gmail.users.drafts.create({
                userId: 'me',
                requestBody: {
                    message: {
                        threadId: email.threadId,
                        raw: encodedMessage
                    }
                }
            });

            const draftUrl = `https://mail.google.com/mail/u/0/#drafts/${draft.id}`;
            
            return {
                message: `Reply draft created and saved to Gmail drafts.\n\n**Gmail draft URL:** ${draftUrl}`,
                to,
                subject,
                replyMessage
            };
        } catch (error) {
            console.error('Failed to create draft:', error);
            // Fallback to compose URL
            const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(replyMessage)}`;
            return {
                message: `Failed to create draft. Gmail compose URL: ${gmailComposeUrl}`,
                to,
                subject, 
                replyMessage
            };
        }
    }
}