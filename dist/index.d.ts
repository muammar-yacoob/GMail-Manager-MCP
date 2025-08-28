#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
export default function ({ sessionId, config }: {
    sessionId: string;
    config: any;
}): Promise<Server<{
    method: string;
    params?: import("zod").objectOutputType<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{
            progressToken: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber]>>;
        }, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{
            progressToken: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber]>>;
        }, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{
            progressToken: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodString, import("zod").ZodNumber]>>;
        }, import("zod").ZodTypeAny, "passthrough">>>;
    }, import("zod").ZodTypeAny, "passthrough"> | undefined;
}, {
    method: string;
    params?: import("zod").objectOutputType<{
        _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
    }, import("zod").ZodTypeAny, "passthrough"> | undefined;
}, import("zod").objectOutputType<{
    _meta: import("zod").ZodOptional<import("zod").ZodObject<{}, "passthrough", import("zod").ZodTypeAny, import("zod").objectOutputType<{}, import("zod").ZodTypeAny, "passthrough">, import("zod").objectInputType<{}, import("zod").ZodTypeAny, "passthrough">>>;
}, import("zod").ZodTypeAny, "passthrough">>>;
