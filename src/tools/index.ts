import { zodToJsonSchema } from 'zod-to-json-schema';
import { gmailTools, sendTools, sendingEnabled } from './gmail.js';
import { calendarTools } from './calendar.js';
import { describeError } from '../batch.js';
import { hasCalendarScope, hasDriveScope, hasSettingsScope } from '../scopes.js';
import { storedScope } from '../auth-paths.js';
import { apiDisabled, activationUrl, scopeRefused } from './google-errors.js';
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
// Filter writes are the only calls that need gmail.settings.basic. list_filters
// reads fine without it, so the gap only shows up on the first create/delete.
const SETTINGS_TOOL_NAMES = new Set(['create_filter', 'delete_filter']);

/**
 * The three ways a 403 can arrive while the rest of the server works fine, and
 * what may honestly be said about each.
 *
 * One table rather than three hand-written branches, because the branches had
 * already drifted: Calendar and the filter tools blamed the token for every
 * 403, Drive alone knew that a switched-off API is a different problem with a
 * different fix. Each entry names the scope that could be missing and the
 * service that could be disabled; the decision between them is written once,
 * in `explain`.
 */
interface PermissionCase {
    tools: Set<string>;
    /** Service name as Google's console URL spells it, for the fallback link. */
    service: string;
    hasScope: (granted: string) => boolean;
    /** The API is off in the Cloud project. Re-authenticating cannot help. */
    apiOff: (consoleUrl: string) => string;
    /** The token genuinely lacks the scope, so re-consenting is the fix. */
    scopeMissing: () => string;
}

const PERMISSION_CASES: PermissionCase[] = [
    {
        tools: CALENDAR_TOOL_NAMES,
        service: 'calendar-json.googleapis.com',
        hasScope: hasCalendarScope,
        apiOff: url =>
            `Google is refusing at the project level, not the token level: the Google Calendar API is ` +
            `switched off in the Google Cloud project behind your OAuth client. Re-running authentication ` +
            `will not help; the API has to be enabled once in the console:\n` +
            `  ${url}\n` +
            `Click Enable, wait a minute for it to propagate, then retry. Mail is unaffected meanwhile.`,
        scopeMissing: () =>
            `The saved credentials predate Calendar support. Google cannot add scopes to a token it ` +
            `already issued, so mail keeps working while calendar access does not.\n` +
            `Fix it by re-running authentication once:\n` +
            `  ${reauthCommand()}`
    },
    {
        tools: DRIVE_TOOL_NAMES,
        service: 'drive.googleapis.com',
        hasScope: hasDriveScope,
        apiOff: url =>
            `Google is refusing at the project level, not the token level: the Drive API is switched off ` +
            `in the Google Cloud project behind your OAuth client. Re-running authentication will not ` +
            `help; the API has to be enabled once in the console:\n` +
            `  ${url}\n` +
            `Click Enable, wait a minute for it to propagate, then retry.\n\n` +
            `download_attachment works regardless; it only touches the local disk.`,
        scopeMissing: () =>
            `The saved credentials predate Drive support. Google cannot add scopes to a token it already ` +
            `issued, so mail keeps working while Drive access does not.\n` +
            `Fix it by re-running authentication once, which will ask for Drive in the consent screen:\n` +
            `  ${reauthCommand()}\n\n` +
            `download_attachment still works in the meantime; it only touches the local disk.`
    },
    {
        tools: SETTINGS_TOOL_NAMES,
        service: 'gmail.googleapis.com',
        hasScope: hasSettingsScope,
        apiOff: url =>
            `Google is refusing at the project level, not the token level: the Gmail API is switched off ` +
            `in the Google Cloud project behind your OAuth client. Re-running authentication will not ` +
            `help; the API has to be enabled once in the console:\n` +
            `  ${url}\n` +
            `Click Enable, wait a minute for it to propagate, then retry.`,
        scopeMissing: () =>
            `Filters live behind gmail.settings.basic, a scope separate from mailbox access, so a token ` +
            `issued before it was requested reads and sends mail while every filter write fails. Listing ` +
            `filters keeps working, which makes this easy to mistake for a bug.\n` +
            `Fix it by re-running authentication once:\n` +
            `  ${reauthCommand()}`
    }
];

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
 * The rule here, learned the hard way: only say what the error actually
 * supports. A 403 is several unrelated failures sharing a status code, and a
 * confident wrong diagnosis is worse than a bare message, because it ends the
 * investigation. Every hint below is gated on something Google said or on the
 * scopes recorded with the saved token.
 */
export function explain(error: any, toolName: string): string {
    const status = Number(error?.code ?? error?.response?.status ?? 0);

    const fault = status === 403 || status === 401 ? PERMISSION_CASES.find(c => c.tools.has(toolName)) : undefined;

    if (fault) {
        // A switched-off API is a project-level refusal: the grant was never the
        // problem, and sending the user round the consent screen changes nothing.
        if (apiDisabled(error)) {
            return `${describeError(error)}\n\n${fault.apiOff(activationUrl(error, fault.service))}`;
        }

        // Either Google named the scopes as the problem, or the saved token can
        // be read and demonstrably lacks this one. A token file we cannot read
        // says nothing, so it does not get to accuse itself.
        const granted = storedScope();
        if (scopeRefused(error) || (granted !== null && !fault.hasScope(granted))) {
            return `${describeError(error)}\n\n${fault.scopeMissing()}`;
        }

        // Anything else - a sharing restriction, a domain policy, a quota rule -
        // falls through to Google's own message, unembellished.
    }

    if (status === 429) {
        return `${describeError(error)}\n\nGmail is rate limiting this account. Retry in a moment, or use the batch tools, which throttle and retry on your behalf.`;
    }

    return error?.message ?? String(error);
}

/** Re-exported so callers can check a token before making a doomed call. */
export { hasCalendarScope, hasDriveScope, hasSettingsScope };
