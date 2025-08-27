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
export declare class GmailService {
    private gmail;
    constructor(auth: OAuth2Client);
    searchEmails(query: string, maxResults?: number): Promise<EmailInfo[]>;
    readEmail(messageId: string): Promise<EmailDetails>;
    deleteEmail(id: string): Promise<void>;
    batchDeleteEmails(ids: string[]): Promise<{
        successes: number;
        failures: number;
    }>;
    listLabels(): Promise<Label[]>;
    createLabel(name: string): Promise<Label>;
    deleteLabel(id: string): Promise<void>;
    applyLabel(messageId: string, labelId: string): Promise<void>;
    removeLabel(messageId: string, labelId: string): Promise<void>;
    batchApplyLabels(messageIds: string[], labelIds: string[]): Promise<{
        successes: number;
        failures: number;
    }>;
    private modifyMessage;
    private batchOperation;
    private extractBody;
}
