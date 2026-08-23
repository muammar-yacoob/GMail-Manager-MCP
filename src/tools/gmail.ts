import { z } from 'zod';
import {
    addressesOf,
    loadAttachments,
    type DraftResult,
    type GmailService,
    type OutgoingAttachment
} from '../gmail-service.js';
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
    attachments: z.array(z.string()).optional().describe("Local file paths to attach. '~' is expanded, e.g. '~/Downloads/form.pdf'. Gmail's limit is 25 MB for the whole encoded message, roughly 18 MB of actual files"),
    threadId: z.string().optional().describe("Thread ID to attach to, so the message threads with an existing conversation")
};

const messageIds = z.array(z.string()).min(1).describe("Array of email message IDs");

/**
 * The block every draft-writing tool ends with.
 *
 * One shared formatter because the recipient line is a hard requirement rather
 * than a nicety: a draft the user cannot check before sending is how mail goes
 * to the wrong person. The addresses come from `DraftResult`, which Gmail
 * populated, so this reports what is genuinely saved rather than echoing the
 * arguments back.
 */
async function draftReport(
    gmail: GmailService,
    draft: DraftResult,
    opening: string,
    extras: string[] = []
): Promise<string> {
    const me = await gmail.myAddress();
    const recipients = addressesOf(draft.to);
    const selfAddressed = Boolean(me) && recipients.length > 0 && recipients.every((a) => a === me);

    const lines = [
        opening,
        '',
        `To: ${draft.to || '(none — Gmail recorded no recipient)'}`,
        draft.cc ? `Cc: ${draft.cc}` : null,
        draft.bcc ? `Bcc: ${draft.bcc}` : null,
        `Subject: ${draft.subject || '(none)'}`,
        ...extras,
        `Draft ID: ${draft.id}`,
        `Open it: ${draft.url}`
    ].filter((l): l is string => l !== null);

    if (!draft.to) {
        lines.push(
            '',
            'WARNING: this draft has no recipient. It cannot be sent as it stands. Set one with update_draft.'
        );
    } else if (selfAddressed) {
        lines.push(
            '',
            `WARNING: the only recipient is your own address (${me}). Sending this delivers it back to your own ` +
                `inbox and nobody else sees it. If that is not what you meant, fix it with update_draft before sending.`
        );
    }

    return lines.join('\n');
}

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
        description: "Draft a threaded reply to a message, saved to Gmail Drafts and not sent. Replies to the original sender by default; pass 'to' to redirect it, or 'cc'/'bcc' to widen it. Replying to a message you sent yourself answers its original recipients rather than looping the draft back to your own address. Always check the To line it reports back before sending.",
        schema: z.object({
            messageId: z.string().describe("Email message ID to reply to"),
            replyMessage: z.string().describe("The reply message content to create as a draft"),
            to: z.string().optional().describe("Override the recipient. Defaults to the original sender, or to the original recipients when replying to your own sent message"),
            cc: z.string().optional().describe("Cc address, or a comma-separated list"),
            bcc: z.string().optional().describe("Bcc address, or a comma-separated list"),
            subject: z.string().optional().describe("Override the subject. Defaults to the original prefixed with 'Re: '"),
            attachments: z.array(z.string()).optional().describe("Local file paths to attach. '~' is expanded")
        }),
        handler: async ({ gmail }, v) => {
            const attachments = v.attachments?.length ? await loadAttachments(v.attachments) : undefined;
            const { draft, recipientSource } = await gmail.createReply(v.messageId, v.replyMessage, {
                to: v.to, cc: v.cc, bcc: v.bcc, subject: v.subject, attachments
            });
            return text(await draftReport(gmail, draft, 'Reply draft saved to Gmail. Not sent.', [
                `Attachments: ${attachments?.length || 0}`,
                `Recipient taken from: ${recipientSource}`,
                `Threaded under: ${draft.threadId || '(new conversation)'}`
            ]));
        }
    },

    create_draft: {
        description: "Compose a new email into Gmail Drafts without sending it: arbitrary To/Cc/Bcc, subject, body and optional local file attachments. Not tied to any thread. Returns a draft URL the user can open, review and send themselves. This is the safe default for composing mail on the user's behalf.",
        schema: z.object(composeFields),
        handler: async ({ gmail }, v) => {
            const attachments = v.attachments?.length ? await loadAttachments(v.attachments) : undefined;
            const draft = await gmail.createDraft({ ...v, attachments });
            return text(await draftReport(gmail, draft, 'Draft saved to Gmail. Not sent.', [
                `Attachments: ${attachments?.length || 0}`
            ]));
        }
    },

    list_drafts: {
        description: "List the drafts currently sitting in Gmail, with their IDs, recipients, subjects and snippets. Use this before update_draft or delete_draft, and to spot superseded drafts worth clearing out.",
        schema: z.object({
            maxResults: z.number().optional().default(20).describe("Maximum number of drafts to return (default: 20)")
        }),
        handler: async ({ gmail }, v) => {
            const drafts = await gmail.listDrafts(v.maxResults);
            if (!drafts.length) return text("No drafts found.");

            const me = await gmail.myAddress();
            const flag = (to: string) => {
                if (!to) return '  <- no recipient; this draft cannot be sent as it stands';
                const addrs = addressesOf(to);
                return me && addrs.length && addrs.every((a) => a === me)
                    ? '  <- addressed only to yourself; sending it would reach nobody else'
                    : '';
            };

            return text(
                `${drafts.length} draft(s):\n\n` +
                drafts.map(d =>
                    `Draft ID: ${d.id}\nTo: ${d.to || '(none)'}${flag(d.to)}\nSubject: ${d.subject || '(none)'}\n` +
                    `Snippet: ${d.snippet}\nURL: ${d.url}\n`
                ).join('---\n')
            );
        }
    },

    update_draft: {
        description: "Edit an existing draft in place, keeping the same draft ID and URL. Pass only the fields you want to change; anything omitted keeps its current value, and existing attachments are carried over unless 'attachments' is supplied. Use this to correct a draft rather than creating a second one.",
        schema: z.object({
            draftId: z.string().describe("Draft ID to edit, from list_drafts"),
            to: z.string().optional().describe("Replace the recipients. Omit to keep the current ones"),
            subject: z.string().optional().describe("Replace the subject. Omit to keep the current one"),
            body: z.string().optional().describe("Replace the plain-text body. Omit to keep the current one"),
            html: z.string().optional().describe("Optional HTML body, sent as an alternative alongside the plain text"),
            cc: z.string().optional().describe("Replace the Cc list. Pass an empty string to clear it"),
            bcc: z.string().optional().describe("Replace the Bcc list. Pass an empty string to clear it"),
            attachments: z.array(z.string()).optional().describe("Replace the attachments with these local file paths. Omit to keep the existing ones; pass an empty array to strip them all"),
            threadId: z.string().optional().describe("Thread to attach to. Omit to keep the draft where it is")
        }),
        handler: async ({ gmail }, v) => {
            // Gmail's drafts.update is a whole-message replace with no partial
            // form, so a caller who only wanted to fix a typo would blank the
            // recipients and lose the attachments. Read the draft first and
            // merge, which is what "edit" is understood to mean.
            const current = await gmail.getDraft(v.draftId);

            let attachments: OutgoingAttachment[] | undefined;
            if (v.attachments === undefined) {
                attachments = current.attachments.length ? await gmail.draftAttachments(current) : undefined;
            } else if (v.attachments.length) {
                attachments = await loadAttachments(v.attachments);
            }

            const draft = await gmail.updateDraft(v.draftId, {
                to: v.to ?? current.to,
                subject: v.subject ?? current.subject,
                body: v.body ?? current.body,
                html: v.html,
                cc: v.cc ?? current.cc,
                bcc: v.bcc ?? current.bcc,
                threadId: v.threadId ?? current.threadId,
                attachments
            });

            const carried = v.attachments === undefined && current.attachments.length;
            return text(await draftReport(gmail, draft, 'Draft updated in place. Not sent.', [
                `Attachments: ${attachments?.length || 0}${carried ? ' (carried over from the previous version)' : ''}`
            ]));
        }
    },

    delete_draft: {
        description: "Delete a draft without sending it. Use this to clear superseded drafts so the wrong version cannot be sent by mistake.",
        schema: z.object({ draftId: z.string().describe("Draft ID to delete, from list_drafts") }),
        handler: async ({ gmail }, v) => {
            // Read it first, purely so the confirmation names what went. "Draft
            // r-123 deleted" is unverifiable after the fact; the recipient and
            // subject let the user see whether it was the one they meant.
            let wasAddressed = '';
            try {
                const doomed = await gmail.getDraft(v.draftId);
                wasAddressed = `\nIt was addressed to: ${doomed.to || '(no recipient)'}\nSubject: ${doomed.subject || '(none)'}`;
            } catch {
                // Gone or unreadable; the delete below will report the real problem.
            }

            await gmail.deleteDraft(v.draftId);
            return text(`Draft ${v.draftId} deleted. It was not sent.${wasAddressed}`);
        }
    },

    // --- Attachments -------------------------------------------------------

    list_attachments: {
        description: "List the attachments on an email. Use the filename to refer to one in download_attachment or save_attachment_to_drive.",
        schema: z.object({ messageId: z.string().describe("Email message ID") }),
        handler: async ({ gmail }, v) => {
            const email = await gmail.readEmail(v.messageId);
            if (!email.attachments.length) return text("This email has no attachments.");

            // Filenames, not IDs. Gmail mints a fresh attachmentId on every read
            // of the message, so an ID printed here is stale as an identifier
            // the moment anything re-reads the message — it would only invite
            // callers to match on something that never matches.
            return text(
                `${email.attachments.length} attachment(s) on "${email.subject || '(no subject)'}":\n\n` +
                email.attachments.map(a =>
                    `Filename: ${a.filename}\nType: ${a.mimeType}\nSize: ${a.size} bytes\n`
                ).join('---\n')
            );
        }
    },

    download_attachment: {
        description: "Save an email attachment to a local file path. Identify it by 'filename' from list_attachments; an attachmentId still works but cannot pick between several attachments, because Gmail issues a different one on every read.",
        schema: z.object({
            messageId: z.string().describe("Email message ID"),
            filename: z.string().optional().describe("Which attachment to take, by its filename. Optional when the message has only one"),
            attachmentId: z.string().optional().describe("Attachment ID from list_attachments. Prefer 'filename'"),
            destination: z.string().describe("Where to save it, e.g. '~/Downloads/form.pdf'. Directories are created as needed")
        }),
        handler: async ({ gmail }, v) => {
            const ref = await gmail.resolveAttachment(v.messageId, {
                filename: v.filename,
                attachmentId: v.attachmentId
            });
            const saved = await gmail.downloadAttachment(v.messageId, ref.attachmentId, v.destination);
            return text(`Attachment saved to ${saved}\nFilename: ${ref.filename}\nType: ${ref.mimeType}\nSize: ${ref.size} bytes`);
        }
    },

    save_attachment_to_drive: {
        description: "Copy an email attachment straight into Google Drive, without leaving it on the local disk. Optionally into a specific folder, and optionally renamed. Identify the attachment by 'filename' — Gmail's attachment IDs change between reads. Needs the Drive scope, granted by re-running authentication.",
        schema: z.object({
            messageId: z.string().describe("Email message ID"),
            filename: z.string().optional().describe("Which attachment to take, by its filename as shown by list_attachments. Optional when the message has only one attachment"),
            folderId: z.string().optional().describe("Drive folder ID to file it under. Omit to put it in My Drive"),
            name: z.string().optional().describe("Rename the file in Drive. Defaults to the attachment's own name")
        }),
        handler: async ({ gmail, drive }, v) => {
            // Name and type come from the message rather than the caller: they
            // are already recorded against the attachment, and guessing them
            // produces files called "untitled".
            const ref = await gmail.resolveAttachment(v.messageId, { filename: v.filename });
            const content = await gmail.getAttachment(v.messageId, ref.attachmentId);
            const saved = await drive.uploadFile(v.name || ref.filename, ref.mimeType, content, v.folderId);

            return text([
                `Saved to Google Drive: ${saved.name}`,
                `Type: ${ref.mimeType}`,
                `Size: ${saved.size} bytes`,
                `Drive file ID: ${saved.id}`,
                `Open it: ${saved.webViewLink}`,
                `From: ${ref.subject || '(no subject)'} — ${ref.from}`,
                saved.fellBackToRoot ? `\nNOTE: ${saved.fellBackToRoot}` : null
            ].filter(Boolean).join('\n'));
        }
    },

    // --- Auth --------------------------------------------------------------

    authenticate_gmail: {
        description: "Authenticate Google access via web browser (opens browser automatically). Covers Gmail, Calendar and Drive.",
        schema: z.object({}),
        handler: async ({ authenticate }) => text(await authenticate())
    }
});

/**
 * Tools that put mail on the wire. Off unless GMAIL_ENABLE_SEND is set.
 *
 * Composing is safe to automate and delivery is not: a draft can be read,
 * corrected or thrown away, whereas SMTP has no recall and an assistant that
 * can send is one mistake away from mailing the wrong person. The default is
 * therefore that this server writes drafts and a human presses send.
 *
 * These are kept as working tools rather than deleted so the capability is one
 * environment variable away for anyone who wants it:
 *
 *   "env": { "GMAIL_ENABLE_SEND": "1" }
 *
 * in the MCP client config, then restart the client.
 */
export const sendTools = defineTools({
    send_email: {
        description: "Send a new email immediately, optionally with local file attachments. This delivers straight away and cannot be recalled afterwards. Prefer create_draft unless the user has explicitly asked for it to be sent.",
        schema: z.object(composeFields),
        handler: async ({ gmail }, v) => {
            const attachments = v.attachments?.length ? await loadAttachments(v.attachments) : undefined;
            const sent = await gmail.sendEmail({ ...v, attachments });
            return text(`Sent to ${v.to}\nSubject: ${v.subject}\nAttachments: ${attachments?.length || 0}\nMessage ID: ${sent.id}\nGmail URL: ${gmail.getEmailUrl(sent.id)}`);
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
    }
});

/** Whether the client has opted in to letting this server deliver mail. */
export function sendingEnabled(): boolean {
    const flag = (process.env.GMAIL_ENABLE_SEND || '').toLowerCase();
    return flag === '1' || flag === 'true' || flag === 'yes';
}
