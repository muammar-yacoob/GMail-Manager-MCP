import { google } from 'googleapis';
export class GmailService {
    gmail;
    constructor(auth) {
        this.gmail = google.gmail({ version: 'v1', auth });
    }
    async searchEmails(query, maxResults = 10) {
        const { data } = await this.gmail.users.messages.list({ userId: 'me', q: query, maxResults });
        if (!data.messages?.length)
            return [];
        return Promise.all(data.messages.map(async (msg) => {
            const { data: detail } = await this.gmail.users.messages.get({
                userId: 'me',
                id: msg.id,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From', 'To', 'Date']
            });
            const h = detail.payload?.headers || [];
            const findHeader = (name) => h.find(x => x.name === name)?.value || '';
            return {
                id: msg.id,
                threadId: detail.threadId,
                subject: findHeader('Subject'),
                from: findHeader('From'),
                to: findHeader('To'),
                date: findHeader('Date'),
                snippet: detail.snippet || ''
            };
        }));
    }
    async readEmail(messageId) {
        const { data } = await this.gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
        const h = data.payload?.headers || [];
        const findHeader = (name) => h.find(x => x.name?.toLowerCase() === name.toLowerCase())?.value || '';
        return {
            id: messageId,
            threadId: data.threadId || '',
            subject: findHeader('subject'),
            from: findHeader('from'),
            to: findHeader('to'),
            date: findHeader('date'),
            body: this.extractBody(data.payload)
        };
    }
    async deleteEmail(id) {
        await this.gmail.users.messages.delete({ userId: 'me', id });
    }
    async batchDeleteEmails(ids) {
        return this.batchOperation(ids, (id) => this.deleteEmail(id));
    }
    async listLabels() {
        const { data } = await this.gmail.users.labels.list({ userId: 'me' });
        return (data.labels || []);
    }
    async createLabel(name) {
        const { data } = await this.gmail.users.labels.create({
            userId: 'me',
            requestBody: { name, messageListVisibility: 'show', labelListVisibility: 'labelShow' }
        });
        return data;
    }
    async deleteLabel(id) {
        await this.gmail.users.labels.delete({ userId: 'me', id });
    }
    async applyLabel(messageId, labelId) {
        await this.modifyMessage(messageId, { addLabelIds: [labelId] });
    }
    async removeLabel(messageId, labelId) {
        await this.modifyMessage(messageId, { removeLabelIds: [labelId] });
    }
    async batchApplyLabels(messageIds, labelIds) {
        return this.batchOperation(messageIds, (id) => this.modifyMessage(id, { addLabelIds: labelIds }));
    }
    async modifyMessage(id, requestBody) {
        await this.gmail.users.messages.modify({ userId: 'me', id, requestBody });
    }
    async batchOperation(items, operation) {
        let successes = 0, failures = 0;
        const batchSize = 50;
        for (let i = 0; i < items.length; i += batchSize) {
            const results = await Promise.allSettled(items.slice(i, i + batchSize).map(operation));
            results.forEach(r => r.status === 'fulfilled' ? successes++ : failures++);
        }
        return { successes, failures };
    }
    extractBody(payload) {
        if (!payload)
            return '';
        let text = '', html = '';
        if (payload.body?.data) {
            const content = Buffer.from(payload.body.data, 'base64').toString('utf8');
            if (payload.mimeType === 'text/plain')
                text = content;
            else if (payload.mimeType === 'text/html')
                html = content;
        }
        if (payload.parts) {
            for (const part of payload.parts) {
                const extracted = this.extractBody(part);
                if (extracted)
                    text = text ? `${text}\n${extracted}` : extracted;
            }
        }
        return text || html || '';
    }
}
