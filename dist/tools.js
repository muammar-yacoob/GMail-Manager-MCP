import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
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
    })
};
const toolDescriptions = {
    search_emails: "Search emails using Gmail query syntax",
    read_email: "Read the full content of an email",
    delete_email: "Permanently delete an email",
    batch_delete_emails: "Delete multiple emails at once",
    list_labels: "List all Gmail labels",
    create_label: "Create a new Gmail label",
    delete_label: "Delete a Gmail label",
    apply_label: "Apply a label to an email",
    remove_label: "Remove a label from an email",
    batch_apply_labels: "Apply labels to multiple emails at once"
};
export const getToolDefinitions = () => Object.entries(schemas).map(([name, schema]) => ({
    name,
    description: toolDescriptions[name],
    inputSchema: zodToJsonSchema(schema)
}));
export async function handleToolCall(gmailService, name, args) {
    try {
        const schema = schemas[name];
        if (!schema)
            throw new Error(`Unknown tool: ${name}`);
        const validated = schema.parse(args);
        switch (name) {
            case "search_emails": {
                const v = validated;
                const results = await gmailService.searchEmails(v.query, v.maxResults);
                return { content: [{ type: "text", text: results.length ?
                                results.map(e => `ID: ${e.id}\nSubject: ${e.subject}\nFrom: ${e.from}\nDate: ${e.date}\nSnippet: ${e.snippet}\n`).join('---\n') :
                                "No emails found." }] };
            }
            case "read_email": {
                const v = validated;
                const email = await gmailService.readEmail(v.messageId);
                return { content: [{ type: "text",
                            text: `Subject: ${email.subject}\nFrom: ${email.from}\nTo: ${email.to}\nDate: ${email.date}\nThread ID: ${email.threadId}\n\nContent:\n${email.body}` }] };
            }
            case "delete_email": {
                const v = validated;
                await gmailService.deleteEmail(v.messageId);
                return { content: [{ type: "text", text: `Email ${v.messageId} deleted successfully.` }] };
            }
            case "batch_delete_emails": {
                const v = validated;
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
                const v = validated;
                const label = await gmailService.createLabel(v.name);
                return { content: [{ type: "text", text: `Label created successfully:\nName: ${label.name}\nID: ${label.id}` }] };
            }
            case "delete_label": {
                const v = validated;
                await gmailService.deleteLabel(v.labelId);
                return { content: [{ type: "text", text: `Label ${v.labelId} deleted successfully.` }] };
            }
            case "apply_label": {
                const v = validated;
                await gmailService.applyLabel(v.messageId, v.labelId);
                return { content: [{ type: "text", text: `Label ${v.labelId} applied to email ${v.messageId}.` }] };
            }
            case "remove_label": {
                const v = validated;
                await gmailService.removeLabel(v.messageId, v.labelId);
                return { content: [{ type: "text", text: `Label ${v.labelId} removed from email ${v.messageId}.` }] };
            }
            case "batch_apply_labels": {
                const v = validated;
                const result = await gmailService.batchApplyLabels(v.messageIds, v.labelIds);
                return { content: [{ type: "text",
                            text: `Batch label application completed:\nSuccessfully processed: ${result.successes} emails\nFailed: ${result.failures} emails` }] };
            }
            default: throw new Error(`Unknown tool: ${name}`);
        }
    }
    catch (error) {
        return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    }
}
