import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GmailService, loadAttachments } from './gmail-service.js';

const composeFields = {
    to: z.string().describe("Recipient address, or a comma-separated list"),
    subject: z.string().describe("Subject line"),
    body: z.string().describe("Plain-text message body"),
    html: z.string().optional().describe("Optional HTML body, sent as an alternative alongside the plain text"),
    cc: z.string().optional().describe("Cc address, or a comma-separated list"),
    bcc: z.string().optional().describe("Bcc address, or a comma-separated list"),
    attachments: z.array(z.string()).optional().describe("Local file paths to attach. '~' is expanded, e.g. '~/Downloads/form.pdf'"),
    threadId: z.string().optional().describe("Thread ID to attach to, so the message threads with an existing conversation")
};

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
    send_email: z.object(composeFields),
    create_draft: z.object(composeFields),
    list_drafts: z.object({
        maxResults: z.number().optional().default(20).describe("Maximum number of drafts to return (default: 20)")
    }),
    update_draft: z.object({
        draftId: z.string().describe("Draft ID to replace"),
        ...composeFields
    }),
    send_draft: z.object({
        draftId: z.string().describe("Draft ID to send")
    }),
    delete_draft: z.object({
        draftId: z.string().describe("Draft ID to delete")
    }),
    get_thread: z.object({
        threadId: z.string().describe("Thread ID, as returned by search_emails or read_email")
    }),
    list_attachments: z.object({
        messageId: z.string().describe("Email message ID")
    }),
    download_attachment: z.object({
        messageId: z.string().describe("Email message ID"),
        attachmentId: z.string().describe("Attachment ID, from list_attachments"),
        destination: z.string().describe("Where to save it, e.g. '~/Downloads/form.pdf'. Directories are created as needed")
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
    send_email: "Send a new email immediately, optionally with local file attachments. This delivers straight away and cannot be recalled afterwards. Prefer create_draft unless the user has explicitly asked for it to be sent.",
    create_draft: "Write a new email into Gmail Drafts without sending it, optionally with local file attachments. Returns a draft URL the user can open, review and send themselves. This is the safe default for composing mail on the user's behalf.",
    list_drafts: "List drafts currently sitting in Gmail, with their IDs and URLs",
    update_draft: "Replace the contents of an existing draft. Gmail has no partial update, so every field is rewritten",
    send_draft: "Send a draft that is already in Gmail. This delivers immediately and cannot be recalled.",
    delete_draft: "Delete a draft without sending it",
    get_thread: "Read every message in a conversation at once, oldest first. Cheaper and better ordered than reading each message separately",
    list_attachments: "List the attachments on an email, with the IDs needed to download them",
    download_attachment: "Save an email attachment to a local file path",
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
                const attachments = v.attachments?.length ? await loadAttachments(v.attachments) : undefined;
                const sent = await gmailService.sendEmail({ ...v, attachments });
                return { content: [{ type: "text",
                    text: `Sent to ${v.to}\nSubject: ${v.subject}\nAttachments: ${attachments?.length || 0}\nMessage ID: ${sent.id}\nGmail URL: ${gmailService.getEmailUrl(sent.id)}` }] };
            }

            case "create_draft": {
                const v = validated as z.infer<typeof schemas.create_draft>;
                const attachments = v.attachments?.length ? await loadAttachments(v.attachments) : undefined;
                const draft = await gmailService.createDraft({ ...v, attachments });
                return { content: [{ type: "text",
                    text: `Draft saved to Gmail. Not sent.\n\nTo: ${v.to}\nSubject: ${v.subject}\nAttachments: ${attachments?.length || 0}\nDraft ID: ${draft.id}\nOpen it: ${draft.url}` }] };
            }

            case "list_drafts": {
                const v = validated as z.infer<typeof schemas.list_drafts>;
                const drafts = await gmailService.listDrafts(v.maxResults);
                return { content: [{ type: "text", text: drafts.length ?
                    drafts.map(d => `Draft ID: ${d.id}\nTo: ${d.to}\nSubject: ${d.subject}\nSnippet: ${d.snippet}\nURL: ${d.url}\n`).join('---\n') :
                    "No drafts found." }] };
            }

            case "update_draft": {
                const v = validated as z.infer<typeof schemas.update_draft>;
                const attachments = v.attachments?.length ? await loadAttachments(v.attachments) : undefined;
                const draft = await gmailService.updateDraft(v.draftId, { ...v, attachments });
                return { content: [{ type: "text",
                    text: `Draft updated. Not sent.\n\nTo: ${v.to}\nSubject: ${v.subject}\nAttachments: ${attachments?.length || 0}\nOpen it: ${draft.url}` }] };
            }

            case "send_draft": {
                const v = validated as z.infer<typeof schemas.send_draft>;
                const sent = await gmailService.sendDraft(v.draftId);
                return { content: [{ type: "text",
                    text: `Draft ${v.draftId} sent.\nMessage ID: ${sent.id}\nGmail URL: ${gmailService.getEmailUrl(sent.id)}` }] };
            }

            case "delete_draft": {
                const v = validated as z.infer<typeof schemas.delete_draft>;
                await gmailService.deleteDraft(v.draftId);
                return { content: [{ type: "text", text: `Draft ${v.draftId} deleted.` }] };
            }

            case "get_thread": {
                const v = validated as z.infer<typeof schemas.get_thread>;
                const messages = await gmailService.getThread(v.threadId);
                return { content: [{ type: "text", text: messages.length ?
                    `Thread ${v.threadId} — ${messages.length} message(s), oldest first:\n\n` +
                    messages.map((m, i) =>
                        `[${i + 1}] ${m.date}\nFrom: ${m.from}\nTo: ${m.to}\nSubject: ${m.subject}\n` +
                        `Attachments: ${m.attachments.length}\n\n${m.body}`
                    ).join('\n\n---\n\n') :
                    "No messages found in that thread." }] };
            }

            case "list_attachments": {
                const v = validated as z.infer<typeof schemas.list_attachments>;
                const email = await gmailService.readEmail(v.messageId);
                return { content: [{ type: "text", text: email.attachments.length ?
                    email.attachments.map(a =>
                        `Filename: ${a.filename}\nAttachment ID: ${a.attachmentId}\nType: ${a.mimeType}\nSize: ${a.size} bytes\n`
                    ).join('---\n') :
                    "This email has no attachments." }] };
            }

            case "download_attachment": {
                const v = validated as z.infer<typeof schemas.download_attachment>;
                const saved = await gmailService.downloadAttachment(v.messageId, v.attachmentId, v.destination);
                return { content: [{ type: "text", text: `Attachment saved to ${saved}` }] };
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