import { GmailService } from './gmail-service.js';
export declare const getToolDefinitions: () => {
    name: string;
    description: string;
    inputSchema: import("zod-to-json-schema").JsonSchema7Type & {
        $schema?: string | undefined;
        definitions?: {
            [key: string]: import("zod-to-json-schema").JsonSchema7Type;
        } | undefined;
    };
}[];
export declare function handleToolCall(gmailService: GmailService, name: string, args: any): Promise<{
    content: {
        type: string;
        text: string;
    }[];
}>;
