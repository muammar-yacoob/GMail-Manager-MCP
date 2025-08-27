import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface EmailInfo {
    id: string;
    threadId?: string | null;
    subject: string;
    from: string;
    to: string;
    date: string;
    snippet?: string;
}

export interface EmailDetails extends EmailInfo {
    body: string;
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
            body: this.extractBody(data.payload)
        };
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
}