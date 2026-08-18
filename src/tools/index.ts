import { zodToJsonSchema } from 'zod-to-json-schema';
import { gmailTools } from './gmail.js';
import { calendarTools } from './calendar.js';
import { describeError } from '../batch.js';
import { hasCalendarScope } from '../scopes.js';
import { reauthCommand } from '../reauth.js';
import type { ToolContext, ToolMap, ToolResult } from './registry.js';

export type { ToolContext, ToolResult } from './registry.js';

/**
 * Every tool this server offers.
 *
 * Gmail and Calendar are kept in separate modules so each stays readable and
 * neither has to know the other exists; the registry is the only place that
 * needs the combined view.
 */
export const tools: ToolMap = { ...gmailTools, ...calendarTools };

const CALENDAR_TOOL_NAMES = new Set(Object.keys(calendarTools));

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

    if (status === 429) {
        return `${describeError(error)}\n\nGmail is rate limiting this account. Retry in a moment, or use the batch tools, which throttle and retry on your behalf.`;
    }

    return error?.message ?? String(error);
}

/** Re-exported so callers can check a token before making a doomed call. */
export { hasCalendarScope };
