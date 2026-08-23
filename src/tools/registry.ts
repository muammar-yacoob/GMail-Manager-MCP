import { z } from 'zod';
import type { GmailService } from '../gmail-service.js';
import type { CalendarService } from '../calendar-service.js';
import type { DriveService } from '../drive-service.js';

/**
 * What a tool handler is given.
 *
 * All three services are built from the same OAuth client, so a tool can reach
 * across if it needs to — save_attachment_to_drive uses two of them at once.
 * `authenticate` is supplied by the server rather than imported, which is what
 * lets authenticate_gmail be an ordinary tool instead of a fake entry that
 * throws and gets special-cased upstream.
 */
export interface ToolContext {
    gmail: GmailService;
    calendar: CalendarService;
    drive: DriveService;
    authenticate: () => Promise<string>;
}

/**
 * Declared as a type alias rather than an interface on purpose: the MCP SDK
 * types a handler's return as `{ [x: string]: unknown } | ServerResult`, and
 * only a type alias picks up the implicit index signature that satisfies it.
 * An interface here fails to assign with a confusing "property 'tools' is
 * missing" error.
 *
 * `type` is the literal 'text', not string, because the SDK discriminates the
 * content union on it.
 */
export type ToolResult = {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
};

export interface ToolSpec<S extends z.ZodTypeAny = z.ZodTypeAny> {
    description: string;
    schema: S;
    handler: (ctx: ToolContext, args: z.infer<S>) => Promise<ToolResult>;
}

export type ToolMap = Record<string, ToolSpec<any>>;

/** Every tool answers with text; this saves repeating the wrapper 30 times. */
export function text(body: string): ToolResult {
    return { content: [{ type: 'text', text: body }] };
}

/** Helper so a tool module keeps its `z.infer` types while staying a plain map. */
export function defineTools<T extends ToolMap>(tools: T): T {
    return tools;
}
