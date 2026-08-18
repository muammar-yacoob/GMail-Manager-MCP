import { z } from 'zod';
import { loadAttachments } from '../gmail-service.js';
import { formatBatchResult } from '../batch.js';
import { canOneClick, oneClickUnsubscribe, parseMailto } from '../unsubscribe.js';
import { defineTools, text } from './registry.js';

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

const messageIds = z.array(z.string()).min(1).describe("Array of email message IDs");

export const gmailTools = defineTools({
    search_emails: {
        description: "Search emails using Gmail query syntax",
        schema: z.object({
            query: z.string().describe("Gmail search query (e.g., 'is:unread', 'from:newsletter@example.com')"),
            maxResults: z.number().optional().default(10).describe("Maximum number of results (default: 10)")
        }),
        handler: async ({ gmail }, v) => {
            const results = await gmail.searchEmails(v.query, v.maxResults);
            return text(results.length
                ? results.map(e => `ID: ${e.id}\nSubject: ${e.subject}\nFrom: ${e.from}\nDate: ${e.date}\nSnippet: ${e.snippet}\nGmail URL: ${gmail.getEmailUrl(e.id)}\n`).join('---\n')
                : "No emails found.");
        }
    },

    read_email: {
        description: "Read the full content of an email",
        schema: z.object({ messageId: z.string().describe("Email message ID") }),
        handler: async ({ gmail }, v) => {
            const email = await gmail.readEmail(v.messageId);
            return text(`Subject: ${email.subject}\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\nThread ID: ${email.threadId}\nGmail URL: ${gmail.getEmailUrl(v.messageId)}\n\nContent:\n${email.body}`);
        }
    },

    get_thread: {
        description: "Read every message in a conversation at once, oldest first. Cheaper and better ordered than reading each message separately",
        schema: z.object({ threadId: z.string().describe("Thread ID, as returned by search_emails or read_email") }),
        handler: async ({ gmail }, v) => {
            const messages = await gmail.getThread(v.threadId);
            return text(messages.length
                ? `Thread ${v.threadId} — ${messages.length} message(s), oldest first:\n\n` +
                  messages.map((m, i) =>
                      `[${i + 1}] ${m.date}\nFrom: ${m.from}\nTo: ${m.to}\nSubject: ${m.subject}\n` +
                      `Attachments: ${m.attachments.length}\n\n${m.body}`
                  ).join('\n\n---\n\n')
                : "No messages found in that thread.");
        }
    },

    // --- Removal -----------------------------------------------------------

    trash_emails: {
        description: "Move emails to Trash, where Gmail keeps them for 30 days before clearing them. This is the reversible way to clear an inbox and should be preferred over batch_delete_emails, which is permanent and immediate.",
        schema: z.object({ messageIds }),
        handler: async ({ gmail }, v) => {
            const result = await gmail.batchTrashEmails(v.messageIds);
            return text(formatBatchResult('Moved to Trash', result) +
                `\n\nRecoverable for 30 days: search 'in:trash' to review, or use untrash_emails.`);
        }
    },

    untrash_emails: {
        description: "Pull emails back out of Trash",
        schema: z.object({ messageIds }),
        handler: async ({ gmail }, v) => {
            const result = await gmail.batchUntrashEmails(v.messageIds);
            return text(formatBatchResult('Restored from Trash', result));
        }
    },

    archive_emails: {
        description: "Remove emails from the inbox without deleting them. They stay searchable and keep every other label.",
        schema: z.object({ messageIds }),
        handler: async ({ gmail }, v) => {
            const result = await gmail.batchArchive(v.messageIds);
            return text(formatBatchResult('Archived', result));
        }
    },

    delete_email: {
        description: "Permanently delete a single email. This bypasses Trash and cannot be undone; prefer trash_emails.",
        schema: z.object({ messageId: z.string().describe("Email message ID to delete") }),
        handler: async ({ gmail }, v) => {
            await gmail.deleteEmail(v.messageId);
            return text(`Email ${v.messageId} deleted successfully.`);
        }
    },

    batch_delete_emails: {
        description: "Permanently delete multiple emails. This bypasses Trash and cannot be undone; prefer trash_emails unless the user has explicitly asked for permanent deletion.",
        schema: z.object({ messageIds: messageIds.describe("Array of email message IDs to delete") }),
        handler: async ({ gmail }, v) => {
            const result = await gmail.batchDeleteEmails(v.messageIds);
            return text(formatBatchResult('Permanently deleted', result));
        }
    },

    mark_emails: {
        description: "Mark emails read or unread",
        schema: z.object({
            messageIds,
            read: z.boolean().describe("true marks them read, false marks them unread")
        }),
        handler: async ({ gmail }, v) => {
            const result = await gmail.batchMarkRead(v.messageIds, v.read);
            return text(formatBatchResult(v.read ? 'Marked read' : 'Marked unread', result));
        }
    },

    // --- Labels ------------------------------------------------------------

    list_labels: {
        description: "List all Gmail labels",
        schema: z.object({}),
        handler: async ({ gmail }) => {
            const labels = await gmail.listLabels();
            const system = labels.filter(l => l.type === 'system');
            const user = labels.filter(l => l.type === 'user');
            return text(labels.length
                ? `System Labels (${system.length}):\n${system.map(l => `  - ${l.name} (${l.id})`).join('\n')}\n\nUser Labels (${user.length}):\n${user.map(l => `  - ${l.name} (${l.id})`).join('\n')}`
                : "No labels found.");
        }
    },

    create_label: {
        description: "Create a new Gmail label. If the label already exists its existing ID is returned rather than failing.",
        schema: z.object({ name: z.string().describe("Label name") }),
        handler: async ({ gmail }, v) => {
            // Creating a label that already exists 409s. Callers almost always
            // just want the id, so hand back the existing one instead of making
            // them go and list labels to recover.
            const existing = (await gmail.listLabels()).find(
                l => (l.name || '').toLowerCase() === v.name.toLowerCase()
            );
            if (existing) {
                return text(`Label already exists, reusing it:\nName: ${existing.name}\nID: ${existing.id}`);
            }
            const label = await gmail.createLabel(v.name);
            return text(`Label created successfully:\nName: ${label.name}\nID: ${label.id}`);
        }
    },

    delete_label: {
        description: "Delete a Gmail label",
        schema: z.object({ labelId: z.string().describe("Label ID to delete") }),
        handler: async ({ gmail }, v) => {
            await gmail.deleteLabel(v.labelId);
            return text(`Label ${v.labelId} deleted successfully.`);
        }
    },

    apply_label: {
        description: "Apply a label to an email",
        schema: z.object({
            messageId: z.string().describe("Email message ID"),
            labelId: z.string().describe("Label ID to apply")
        }),
        handler: async ({ gmail }, v) => {
            await gmail.applyLabel(v.messageId, v.labelId);
            return text(`Label ${v.labelId} applied to email ${v.messageId}.`);
        }
    },

    remove_label: {
        description: "Remove a label from an email",
        schema: z.object({
            messageId: z.string().describe("Email message ID"),
            labelId: z.string().describe("Label ID to remove")
        }),
        handler: async ({ gmail }, v) => {
            await gmail.removeLabel(v.messageId, v.labelId);
            return text(`Label ${v.labelId} removed from email ${v.messageId}.`);
        }
    },

    batch_apply_labels: {
        description: "Apply labels to multiple emails at once",
        schema: z.object({
            messageIds,
            labelIds: z.array(z.string()).min(1).describe("Array of label IDs to apply")
        }),
        handler: async ({ gmail }, v) => {
            const result = await gmail.batchApplyLabels(v.messageIds, v.labelIds);
            return text(formatBatchResult('Labels applied', result));
        }
    },

    batch_remove_labels: {
        description: "Remove labels from multiple emails at once",
        schema: z.object({
            messageIds,
            labelIds: z.array(z.string()).min(1).describe("Array of label IDs to remove")
        }),
        handler: async ({ gmail }, v) => {
            const result = await gmail.batchRemoveLabels(v.messageIds, v.labelIds);
            return text(formatBatchResult('Labels removed', result));
        }
    },

    // --- Filters (server-side rules) ---------------------------------------

    list_filters: {
        description: "List the Gmail filters (rules) currently set on the account",
        schema: z.object({}),
        handler: async ({ gmail }) => {
            const filters = await gmail.listFilters();
            if (!filters.length) return text("No filters are set on this account.");
            return text(filters.map(f => {
                const c = Object.entries(f.criteria || {}).map(([k, val]) => `${k}=${val}`).join(', ');
                const a = Object.entries(f.action || {}).map(([k, val]) => `${k}=${Array.isArray(val) ? val.join('|') : val}`).join(', ');
                return `ID: ${f.id}\n  When: ${c || '(nothing)'}\n  Then: ${a || '(nothing)'}`;
            }).join('\n---\n'));
        }
    },

    create_filter: {
        description: "Create a Gmail filter so future mail is handled automatically. Unlike labelling messages by hand, this keeps applying to mail that has not arrived yet. Use label IDs from list_labels; the special IDs TRASH, SPAM and INBOX work too (removing INBOX archives, adding TRASH deletes).",
        schema: z.object({
            from: z.string().optional().describe("Match the sender, e.g. 'newsletter@example.com' or 'example.com'"),
            to: z.string().optional().describe("Match the recipient"),
            subject: z.string().optional().describe("Match words in the subject"),
            query: z.string().optional().describe("Any Gmail search expression, e.g. 'unsubscribe OR newsletter'"),
            negatedQuery: z.string().optional().describe("Gmail search expression that must NOT match"),
            hasAttachment: z.boolean().optional().describe("Only match messages with attachments"),
            addLabelIds: z.array(z.string()).optional().describe("Labels to apply. Use TRASH to delete, SPAM to mark as spam"),
            removeLabelIds: z.array(z.string()).optional().describe("Labels to strip. Use INBOX to archive, UNREAD to mark as read")
        }),
        handler: async ({ gmail }, v) => {
            const filter = await gmail.createFilter(
                {
                    from: v.from, to: v.to, subject: v.subject,
                    query: v.query, negatedQuery: v.negatedQuery, hasAttachment: v.hasAttachment
                },
                { addLabelIds: v.addLabelIds, removeLabelIds: v.removeLabelIds }
            );
            return text(`Filter created. ID: ${filter.id}\n\nThis applies to mail arriving from now on; it does not touch messages already in the mailbox.`);
        }
    },

    delete_filter: {
        description: "Delete a Gmail filter by ID",
        schema: z.object({ filterId: z.string().describe("Filter ID, from list_filters") }),
        handler: async ({ gmail }, v) => {
            await gmail.deleteFilter(v.filterId);
            return text(`Filter ${v.filterId} deleted.`);
        }
    },

    get_unsubscribe_info: {
        description: "Read the List-Unsubscribe details a sender published for a message, and report which opt-out routes are on offer without using any of them. Use unsubscribe_email to actually opt out.",
        schema: z.object({ messageId: z.string().describe("Email message ID") }),
        handler: async ({ gmail }, v) => {
            const info = await gmail.getUnsubscribeInfo(v.messageId);
            if (!info.mailto && !info.url) {
                return text(`From: ${info.from}\nSubject: ${info.subject}\n\nNo List-Unsubscribe header. Opting out would mean finding a link in the message body, or filtering the sender instead.`);
            }
            return text([
                `From: ${info.from}`,
                `Subject: ${info.subject}`,
                info.url ? `Unsubscribe link: ${info.url}` : null,
                info.mailto ? `Unsubscribe by email: ${info.mailto}` : null,
                '',
                canOneClick(info)
                    ? 'One-click (RFC 8058) is available: unsubscribe_email can complete this on its own.'
                    : 'No one-click declaration. unsubscribe_email will need permission to send the email opt-out, or hand you the link to open yourself.'
            ].filter(Boolean).join('\n'));
        }
    },

    unsubscribe_email: {
        description: "Opt out of the mailing list a message came from, using the route its sender published. Prefers RFC 8058 one-click, a single HTTPS POST the sender has declared safe to automate. When only a mailto: opt-out exists it stops and says so, unless sendEmail is true, because that sends mail from the user's account. A plain link with no one-click declaration is handed back for the user to open; this never visits arbitrary URLs found in mail.",
        schema: z.object({
            messageId: z.string().describe("ID of a message from the list you want off"),
            sendEmail: z.boolean().optional().describe("Permission to send the mailto: opt-out from the user's account when one-click is unavailable. Ask the user before setting this.")
        }),
        handler: async ({ gmail }, v) => {
            const info = await gmail.getUnsubscribeInfo(v.messageId);
            const who = `From: ${info.from}\nSubject: ${info.subject}\n`;
            const fallback = 'Ask to have a filter created for this sender instead, which works whether or not they honour the opt-out.';

            if (canOneClick(info)) {
                const { status, ok } = await oneClickUnsubscribe(info.url!);
                return text(ok
                    ? `${who}\nUnsubscribed by one-click POST (HTTP ${status}). Removal can take a few days to take effect at the sender's end.`
                    : `${who}\nThe sender's one-click endpoint returned HTTP ${status}, so the opt-out did not go through.\n${fallback}`);
            }

            if (info.mailto) {
                const mail = parseMailto(info.mailto);
                if (!v.sendEmail) {
                    return text(`${who}\nThe only machine-readable opt-out here is by email, to ${mail.to} with subject "${mail.subject}".\nThat sends a message from your account, so say the word and I will call this again with sendEmail: true.`);
                }
                const sent = await gmail.sendEmail({ to: mail.to, subject: mail.subject, body: mail.body });
                return text(`${who}\nOpt-out emailed to ${mail.to} (message ${sent.id}). Removal can take a few days to take effect at the sender's end.`);
            }

            if (info.url) {
                return text(`${who}\nThe sender published an unsubscribe link but did not mark it one-click safe, so it needs a browser and possibly a confirmation step:\n${info.url}\n\nOpen it yourself. ${fallback}`);
            }

            return text(`${who}\nNo List-Unsubscribe header, so there is no opt-out to perform. ${fallback}`);
        }
    },

    // --- Composing ---------------------------------------------------------

    create_reply: {
        description: "Generate a brief, natural reply draft and provide Gmail compose URL",
        schema: z.object({
            messageId: z.string().describe("Email message ID to reply to"),
            replyMessage: z.string().describe("The reply message content to create as a draft")
        }),
        handler: async ({ gmail }, v) => {
            const result = await gmail.createReply(v.messageId, v.replyMessage);
            return text(`${result.message}\n\n**Draft Preview:**\n\n**To:** ${result.to}\n**Subject:** ${result.subject}\n\n**Message:**\n\`\`\`\n${result.replyMessage}\n\`\`\``);
        }
    },

    send_email: {
        description: "Send a new email immediately, optionally with local file attachments. This delivers straight away and cannot be recalled afterwards. Prefer create_draft unless the user has explicitly asked for it to be sent.",
        schema: z.object(composeFields),
        handler: async ({ gmail }, v) => {
            const attachments = v.attachments?.length ? await loadAttachments(v.attachments) : undefined;
            const sent = await gmail.sendEmail({ ...v, attachments });
            return text(`Sent to ${v.to}\nSubject: ${v.subject}\nAttachments: ${attachments?.length || 0}\nMessage ID: ${sent.id}\nGmail URL: ${gmail.getEmailUrl(sent.id)}`);
        }
    },

    create_draft: {
        description: "Write a new email into Gmail Drafts without sending it, optionally with local file attachments. Returns a draft URL the user can open, review and send themselves. This is the safe default for composing mail on the user's behalf.",
        schema: z.object(composeFields),
        handler: async ({ gmail }, v) => {
            const attachments = v.attachments?.length ? await loadAttachments(v.attachments) : undefined;
            const draft = await gmail.createDraft({ ...v, attachments });
            return text(`Draft saved to Gmail. Not sent.\n\nTo: ${v.to}\nSubject: ${v.subject}\nAttachments: ${attachments?.length || 0}\nDraft ID: ${draft.id}\nOpen it: ${draft.url}`);
        }
    },

    list_drafts: {
        description: "List drafts currently sitting in Gmail, with their IDs and URLs",
        schema: z.object({
            maxResults: z.number().optional().default(20).describe("Maximum number of drafts to return (default: 20)")
        }),
        handler: async ({ gmail }, v) => {
            const drafts = await gmail.listDrafts(v.maxResults);
            return text(drafts.length
                ? drafts.map(d => `Draft ID: ${d.id}\nTo: ${d.to}\nSubject: ${d.subject}\nSnippet: ${d.snippet}\nURL: ${d.url}\n`).join('---\n')
                : "No drafts found.");
        }
    },

    update_draft: {
        description: "Replace the contents of an existing draft. Gmail has no partial update, so every field is rewritten",
        schema: z.object({ draftId: z.string().describe("Draft ID to replace"), ...composeFields }),
        handler: async ({ gmail }, v) => {
            const attachments = v.attachments?.length ? await loadAttachments(v.attachments) : undefined;
            const draft = await gmail.updateDraft(v.draftId, { ...v, attachments });
            return text(`Draft updated. Not sent.\n\nTo: ${v.to}\nSubject: ${v.subject}\nAttachments: ${attachments?.length || 0}\nOpen it: ${draft.url}`);
        }
    },

    send_draft: {
        description: "Send a draft that is already in Gmail. This delivers immediately and cannot be recalled.",
        schema: z.object({ draftId: z.string().describe("Draft ID to send") }),
        handler: async ({ gmail }, v) => {
            const sent = await gmail.sendDraft(v.draftId);
            return text(`Draft ${v.draftId} sent.\nMessage ID: ${sent.id}\nGmail URL: ${gmail.getEmailUrl(sent.id)}`);
        }
    },

    delete_draft: {
        description: "Delete a draft without sending it",
        schema: z.object({ draftId: z.string().describe("Draft ID to delete") }),
        handler: async ({ gmail }, v) => {
            await gmail.deleteDraft(v.draftId);
            return text(`Draft ${v.draftId} deleted.`);
        }
    },

    resend_email: {
        description: "Send a fresh copy of an already-sent email, carrying its attachments over, optionally editing the recipient, subject or body. This does NOT recall or replace the original: SMTP has no recall, so the first message stays delivered and the recipient ends up with both.",
        schema: z.object({
            messageId: z.string().describe("ID of the already-sent message to send a fresh copy of"),
            to: z.string().optional().describe("Override the recipient (defaults to the original To)"),
            subject: z.string().optional().describe("Override the subject (defaults to the original)"),
            body: z.string().optional().describe("Override the body (defaults to the original text body)"),
            cc: z.string().optional().describe("Cc address, or a comma-separated list"),
            bcc: z.string().optional().describe("Bcc address, or a comma-separated list")
        }),
        handler: async ({ gmail }, v) => {
            const sent = await gmail.resendEmail(v.messageId, {
                to: v.to, subject: v.subject, body: v.body, cc: v.cc, bcc: v.bcc
            });
            return text(`Re-sent a copy to ${sent.to}\nSubject: ${sent.subject}\nAttachments carried over: ${sent.attachments}\nNew message ID: ${sent.id}\nGmail URL: ${gmail.getEmailUrl(sent.id)}\n\nNote: the original message ${v.messageId} is still delivered. This did not recall it.`);
        }
    },

    // --- Attachments -------------------------------------------------------

    list_attachments: {
        description: "List the attachments on an email, with the IDs needed to download them",
        schema: z.object({ messageId: z.string().describe("Email message ID") }),
        handler: async ({ gmail }, v) => {
            const email = await gmail.readEmail(v.messageId);
            return text(email.attachments.length
                ? email.attachments.map(a =>
                      `Filename: ${a.filename}\nAttachment ID: ${a.attachmentId}\nType: ${a.mimeType}\nSize: ${a.size} bytes\n`
                  ).join('---\n')
                : "This email has no attachments.");
        }
    },

    download_attachment: {
        description: "Save an email attachment to a local file path",
        schema: z.object({
            messageId: z.string().describe("Email message ID"),
            attachmentId: z.string().describe("Attachment ID, from list_attachments"),
            destination: z.string().describe("Where to save it, e.g. '~/Downloads/form.pdf'. Directories are created as needed")
        }),
        handler: async ({ gmail }, v) => {
            const saved = await gmail.downloadAttachment(v.messageId, v.attachmentId, v.destination);
            return text(`Attachment saved to ${saved}`);
        }
    },

    // --- Auth --------------------------------------------------------------

    authenticate_gmail: {
        description: "Authenticate Google access via web browser (opens browser automatically). Covers both Gmail and Calendar.",
        schema: z.object({}),
        handler: async ({ authenticate }) => text(await authenticate())
    }
});
