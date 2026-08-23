import { zodToJsonSchema } from 'zod-to-json-schema';
import { gmailTools, sendTools, sendingEnabled } from './gmail.js';
import { calendarTools } from './calendar.js';
import { describeError } from '../batch.js';
import { hasCalendarScope, hasDriveScope } from '../scopes.js';
import { reauthCommand } from '../reauth.js';
import type { ToolContext, ToolMap, ToolResult } from './registry.js';

export type { ToolContext, ToolResult } from './registry.js';

/**
 * Every tool this server offers.
 *
 * Gmail and Calendar are kept in separate modules so each stays readable and
 * neither has to know the other exists; the registry is the only place that
 * needs the combined view.
 *
 * The send tools join that view only when the client has opted in. They are
 * withheld rather than merely discouraged because a tool the model cannot see
 * is a tool it cannot reach for, and the whole point of a drafts-only server is
 * that a human decides what leaves the mailbox.
 */
export const tools: ToolMap = {
    ...gmailTools,
    ...(sendingEnabled() ? sendTools : {}),
    ...calendarTools
};

const CALENDAR_TOOL_NAMES = new Set(Object.keys(calendarTools));
const DRIVE_TOOL_NAMES = new Set(['save_attachment_to_drive']);

export const getToolDefinitions = () =>
    Object.entries(tools).map(([name, spec]) => ({
        name,
        description: spec.description,
        inputSchema: zodToJsonSchema(spec.schema)
    }));

export async function handleToolCall(ctx: ToolContext, name: string, args: unknown): Promise<ToolResult> {
    const spec = tools[name];
    if (!spec) {
        return { content: [{ type: 'text' as const, text: `Error: Unknown tool: ${name}` }], isError: true };
    }

    try {
        return await spec.handler(ctx, spec.schema.parse(args ?? {}));
    } catch (error: any) {
        return { content: [{ type: 'text' as const, text: `Error: ${explain(error, name)}` }], isError: true };
    }
}

/**
 * Turn an API failure into something the caller can act on.
 *
 * The one that matters most: a token issued before Calendar was added still
 * works perfectly for mail, so the user has no reason to suspect their
 * credentials. Every calendar call then fails with a bare 403 that says
 * nothing about re-authenticating.
 */
function explain(error: any, toolName: string): string {
    const status = Number(error?.code ?? error?.response?.status ?? 0);

    if (CALENDAR_TOOL_NAMES.has(toolName) && (status === 403 || status === 401)) {
        return `${describeError(error)}\n\n` +
            `This usually means the saved credentials predate Calendar support. Google cannot add ` +
            `scopes to a token it already issued, so mail keeps working while calendar access does not.\n` +
            `Fix it by re-running authentication once:\n` +
            `  ${reauthCommand()}`;
    }

    if (DRIVE_TOOL_NAMES.has(toolName) && (status === 403 || status === 401)) {
        // Two very different failures arrive as 403 here and the fixes do not
        // overlap, so telling them apart matters. "Re-run auth" against a
        // disabled API sends the user round the consent flow to no effect.
        const reason = error?.errors?.[0]?.reason ?? '';
        const disabledApi =
            reason === 'accessNotConfigured' || /has not been used in project|is disabled/i.test(error?.message ?? '');

        if (disabledApi) {
            const project = String(error?.message ?? '').match(/project (\d+)/)?.[1];
            return `${describeError(error)}\n\n` +
                `The Drive scope is granted, but the Drive API itself is switched off in the Google Cloud ` +
                `project behind your OAuth client. Re-running authentication will not help; the API has to be ` +
                `enabled once in the console:\n` +
                `  https://console.cloud.google.com/apis/api/drive.googleapis.com/overview` +
                (project ? `?project=${project}` : '') + `\n` +
                `Click Enable, wait a minute for it to propagate, then retry.\n\n` +
                `download_attachment works regardless; it only touches the local disk.`;
        }

        return `${describeError(error)}\n\n` +
            `This usually means the saved credentials predate Drive support. Google cannot add scopes to a ` +
            `token it already issued, so mail keeps working while Drive access does not.\n` +
            `Fix it by re-running authentication once, which will ask for Drive in the consent screen:\n` +
            `  ${reauthCommand()}\n\n` +
            `download_attachment still works in the meantime; it only touches the local disk.`;
    }

    if (status === 429) {
        return `${describeError(error)}\n\nGmail is rate limiting this account. Retry in a moment, or use the batch tools, which throttle and retry on your behalf.`;
    }

    return error?.message ?? String(error);
}

/** Re-exported so callers can check a token before making a doomed call. */
export { hasCalendarScope, hasDriveScope };
