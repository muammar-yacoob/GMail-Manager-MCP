import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GmailService } from './gmail-service.js';

const schemas = {
    search_emails: z.object({
        query: z.string().describe("Gmail search query (e.g., 'is:unread', 'from:newsletter@example.com')"),
        maxResults: z.number().optional().default(10).describe("Maximum number of results (default: 10)")
    }),
    read_email: z.object({ messageId: z.string().describe("Email message ID") }),
    delete_email: z.object({ messageId: z.string().describe("Email message ID to delete") }),
    batch_delete_emails: z.object({ messageIds: z.array(z.string()).describe("Array of email message IDs to delete") }),
    list_labels: z.object({}),
    create_label: z.object({ name: z.string().describe("Label name") }),
    delete_label: z.object({ labelId: z.string().describe("Label ID to delete") }),
    apply_label: z.object({
        messageId: z.string().describe("Email message ID"),
        labelId: z.string().describe("Label ID to apply")
    }),
    remove_label: z.object({
        messageId: z.string().describe("Email message ID"),
        labelId: z.string().describe("Label ID to remove")
    }),
    batch_apply_labels: z.object({
        messageIds: z.array(z.string()).describe("Array of email message IDs"),
        labelIds: z.array(z.string()).describe("Array of label IDs to apply")
    }),
    create_reply: z.object({
        messageId: z.string().describe("Email message ID to reply to"),
        replyMessage: z.string().describe("The reply message content to create as a draft")
    }),
    send_email: z.object({
        to: z.string().describe("Recipient address, or a comma-separated list"),
        subject: z.string().describe("Subject line"),
        body: z.string().describe("Plain-text message body"),
        html: z.string().optional().describe("Optional HTML body, sent as an alternative alongside the plain text"),
        cc: z.string().optional().describe("Cc address, or a comma-separated list"),
        bcc: z.string().optional().describe("Bcc address, or a comma-separated list"),
        threadId: z.string().optional().describe("Thread ID to send into, so the message threads with an existing conversation")
    }),
    resend_email: z.object({
        messageId: z.string().describe("ID of the already-sent message to send a fresh copy of"),
        to: z.string().optional().describe("Override the recipient (defaults to the original To)"),
        subject: z.string().optional().describe("Override the subject (defaults to the original)"),
        body: z.string().optional().describe("Override the body (defaults to the original text body)"),
        cc: z.string().optional().describe("Cc address, or a comma-separated list"),
        bcc: z.string().optional().describe("Bcc address, or a comma-separated list")
    }),
    authenticate_gmail: z.object({})
};

const toolDescriptions: Record<string, string> = {
    search_emails: "Search emails using Gmail query syntax",
    read_email: "Read the full content of an email",
    delete_email: "Permanently delete an email",
    batch_delete_emails: "Delete multiple emails at once",
    list_labels: "List all Gmail labels",
    create_label: "Create a new Gmail label",
    delete_label: "Delete a Gmail label",
    apply_label: "Apply a label to an email",
    remove_label: "Remove a label from an email",
    batch_apply_labels: "Apply labels to multiple emails at once",
    create_reply: "Generate a brief, natural reply draft and provide Gmail compose URL",
    send_email: "Send a new email immediately. This delivers straight away and cannot be recalled afterwards.",
    resend_email: "Send a fresh copy of an already-sent email, carrying its attachments over, optionally editing the recipient, subject or body. This does NOT recall or replace the original: SMTP has no recall, so the first message stays delivered and the recipient ends up with both.",
    authenticate_gmail: "Authenticate Gmail access via web browser (opens browser automatically)"
};

export const getToolDefinitions = () => 
    Object.entries(schemas).map(([name, schema]) => ({
        name,
        description: toolDescriptions[name],
        inputSchema: zodToJsonSchema(schema)
    }));

export async function handleToolCall(gmailService: GmailService, name: string, args: any) {
    try {
        const schema = schemas[name as keyof typeof schemas];
        if (!schema) throw new Error(`Unknown tool: ${name}`);
        
        const validated = schema.parse(args);
        
        switch (name) {
            case "search_emails": {
                const v = validated as z.infer<typeof schemas.search_emails>;
                const results = await gmailService.searchEmails(v.query, v.maxResults);
                return { content: [{ type: "text", text: results.length ? 
                    results.map(e => `ID: ${e.id}\nSubject: ${e.subject}\nFrom: ${e.from}\nDate: ${e.date}\nSnippet: ${e.snippet}\nGmail URL: ${gmailService.getEmailUrl(e.id)}\n`).join('---\n') : 
                    "No emails found." }] };
            }
            
            case "read_email": {
                const v = validated as z.infer<typeof schemas.read_email>;
                const email = await gmailService.readEmail(v.messageId);
                return { content: [{ type: "text", 
                    text: `Subject: ${email.subject}\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\nThread ID: ${email.threadId}\nGmail URL: ${gmailService.getEmailUrl(v.messageId)}\n\nContent:\n${email.body}` }] };
            }
            
            case "delete_email": {
                const v = validated as z.infer<typeof schemas.delete_email>;
                await gmailService.deleteEmail(v.messageId);
                return { content: [{ type: "text", text: `Email ${v.messageId} deleted successfully.` }] };
            }
            
            case "batch_delete_emails": {
                const v = validated as z.infer<typeof schemas.batch_delete_emails>;
                const result = await gmailService.batchDeleteEmails(v.messageIds);
                return { content: [{ type: "text", 
                    text: `Batch delete completed:\nSuccessfully deleted: ${result.successes} emails\nFailed: ${result.failures} emails` }] };
            }
            
            case "list_labels": {
                const labels = await gmailService.listLabels();
                const system = labels.filter(l => l.type === 'system');
                const user = labels.filter(l => l.type === 'user');
                return { content: [{ type: "text", text: labels.length ? 
                    `System Labels (${system.length}):\n${system.map(l => `  - ${l.name} (${l.id})`).join('\n')}\n\nUser Labels (${user.length}):\n${user.map(l => `  - ${l.name} (${l.id})`).join('\n')}` : 
                    "No labels found." }] };
            }
            
            case "create_label": {
                const v = validated as z.infer<typeof schemas.create_label>;
                const label = await gmailService.createLabel(v.name);
                return { content: [{ type: "text", text: `Label created successfully:\nName: ${label.name}\nID: ${label.id}` }] };
            }
            
            case "delete_label": {
                const v = validated as z.infer<typeof schemas.delete_label>;
                await gmailService.deleteLabel(v.labelId);
                return { content: [{ type: "text", text: `Label ${v.labelId} deleted successfully.` }] };
            }
            
            case "apply_label": {
                const v = validated as z.infer<typeof schemas.apply_label>;
                await gmailService.applyLabel(v.messageId, v.labelId);
                return { content: [{ type: "text", text: `Label ${v.labelId} applied to email ${v.messageId}.` }] };
            }
            
            case "remove_label": {
                const v = validated as z.infer<typeof schemas.remove_label>;
                await gmailService.removeLabel(v.messageId, v.labelId);
                return { content: [{ type: "text", text: `Label ${v.labelId} removed from email ${v.messageId}.` }] };
            }
            
            case "batch_apply_labels": {
                const v = validated as z.infer<typeof schemas.batch_apply_labels>;
                const result = await gmailService.batchApplyLabels(v.messageIds, v.labelIds);
                return { content: [{ type: "text", 
                    text: `Batch label application completed:\nSuccessfully processed: ${result.successes} emails\nFailed: ${result.failures} emails` }] };
            }
            
            case "create_reply": {
                const v = validated as z.infer<typeof schemas.create_reply>;
                const result = await gmailService.createReply(v.messageId, v.replyMessage);
                return { 
                    content: [{ 
                        type: "text", 
                        text: `${result.message}\n\n**Draft Preview:**\n\n**To:** ${result.to}\n**Subject:** ${result.subject}\n\n**Message:**\n\`\`\`\n${result.replyMessage}\n\`\`\`` 
                    }]
                };
            }
            
            case "send_email": {
                const v = validated as z.infer<typeof schemas.send_email>;
                const sent = await gmailService.sendEmail(v);
                return { content: [{ type: "text",
                    text: `Sent to ${v.to}\nSubject: ${v.subject}\nMessage ID: ${sent.id}\nGmail URL: ${gmailService.getEmailUrl(sent.id)}` }] };
            }

            case "resend_email": {
                const v = validated as z.infer<typeof schemas.resend_email>;
                const sent = await gmailService.resendEmail(v.messageId, {
                    to: v.to, subject: v.subject, body: v.body, cc: v.cc, bcc: v.bcc
                });
                return { content: [{ type: "text",
                    text: `Re-sent a copy to ${sent.to}\nSubject: ${sent.subject}\nAttachments carried over: ${sent.attachments}\nNew message ID: ${sent.id}\nGmail URL: ${gmailService.getEmailUrl(sent.id)}\n\nNote: the original message ${v.messageId} is still delivered. This did not recall it.` }] };
            }

            case "authenticate_gmail": {
                // This is a special case - handled in index.ts
                throw new Error("Authentication should be handled by the main server");
            }
            
            default: throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
}