import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Every calendar 403 used to be answered with "your credentials predate
 * Calendar support, re-run auth", and Drive and the filter tools said the same
 * of their own scopes. The error that actually shows up in practice says
 * nothing of the kind: the token carries the scope and the API is disabled in
 * the Cloud project, which re-authenticating cannot fix. These pin the three
 * outcomes apart, using the real response bodies.
 */

const consoleUrlFor = service => `https://console.developers.google.com/apis/api/${service}/overview?project=39441050708`;
const CONSOLE_URL = consoleUrlFor('calendar-json.googleapis.com');

/** As googleapis surfaces it: legacy `errors[]` and the rpc envelope together. */
const apiDisabledError = (title = 'Google Calendar API', service = 'calendar-json.googleapis.com') => {
    const url = consoleUrlFor(service);
    const message =
        `${title} has not been used in project 39441050708 before or it is disabled. ` +
        `Enable it by visiting ${url} then retry. If you enabled this API recently, wait a few ` +
        'minutes for the action to propagate to our systems and retry.';

    return Object.assign(new Error(message), {
        code: 403,
        errors: [
            {
                message,
                domain: 'usageLimits',
                reason: 'accessNotConfigured',
                // Google really does send the bare console root here, which is
                // why the activation URL is taken from `details` instead.
                extendedHelp: 'https://console.developers.google.com'
            }
        ],
        response: {
            status: 403,
            data: {
                error: {
                    code: 403,
                    status: 'PERMISSION_DENIED',
                    message,
                    details: [
                        {
                            '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
                            reason: 'SERVICE_DISABLED',
                            domain: 'googleapis.com',
                            metadata: { service, activationUrl: url }
                        },
                        {
                            '@type': 'type.googleapis.com/google.rpc.Help',
                            links: [{ description: 'Google developers console API activation', url }]
                        }
                    ]
                }
            }
        }
    });
};

const insufficientScopeError = () =>
    Object.assign(new Error('Request had insufficient authentication scopes.'), {
        code: 403,
        errors: [{ message: 'Insufficient Permission', domain: 'global', reason: 'insufficientPermissions' }],
        response: {
            status: 403,
            data: {
                error: {
                    code: 403,
                    status: 'PERMISSION_DENIED',
                    message: 'Request had insufficient authentication scopes.',
                    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }]
                }
            }
        }
    });

/** A 403 that is neither a scope nor a disabled API: nothing to add to it. */
const forbiddenError = (message = 'You need to have writer access to this calendar.') =>
    Object.assign(new Error(message), {
        code: 403,
        errors: [{ message, domain: 'global', reason: 'forbidden' }]
    });

/** Point credential lookup at a token file this test owns, then load the module. */
async function explainWith(scope) {
    const dir = await mkdtemp(join(tmpdir(), 'gmail-mcp-scopes-'));
    const credsPath = join(dir, 'credentials.json');
    await writeFile(credsPath, JSON.stringify(scope === null ? { access_token: 'x' } : { access_token: 'x', scope }));
    process.env.GMAIL_CREDENTIALS_PATH = credsPath;

    const { explain } = await import('../dist/tools/index.js');
    return explain;
}

const ALL_SCOPES =
    'https://mail.google.com/ https://www.googleapis.com/auth/gmail.settings.basic ' +
    'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.file';

test('a disabled Calendar API is not blamed on the token', async () => {
    const explain = await explainWith(ALL_SCOPES);
    const message = explain(apiDisabledError(), 'list_events');

    assert.match(message, /switched off in the Google Cloud project/);
    assert.match(message, /Re-running authentication will not help/);
    assert.ok(message.includes(CONSOLE_URL), 'surfaces the project-specific console URL from the error body');
    assert.doesNotMatch(message, /predate Calendar support/);
});

test('insufficient scopes still gets the re-auth hint', async () => {
    const explain = await explainWith(ALL_SCOPES);
    const message = explain(insufficientScopeError(), 'list_events');

    assert.match(message, /predate Calendar support/);
    assert.match(message, / auth$/m);
});

test('a token without the calendar scope gets the re-auth hint', async () => {
    const explain = await explainWith('https://mail.google.com/');
    const message = explain(forbiddenError(), 'list_events');

    assert.match(message, /predate Calendar support/);
});

test('any other 403 is passed through unembellished', async () => {
    const explain = await explainWith(ALL_SCOPES);
    const message = explain(forbiddenError(), 'list_events');

    assert.equal(message, 'You need to have writer access to this calendar.');
});

test('a token that records no scopes at all is not accused', async () => {
    const explain = await explainWith(null);
    const message = explain(forbiddenError(), 'list_events');

    assert.doesNotMatch(message, /predate Calendar support/);
});

test('a disabled Drive API is not blamed on the token either', async () => {
    const explain = await explainWith(ALL_SCOPES);
    const message = explain(apiDisabledError('Google Drive API', 'drive.googleapis.com'), 'save_attachment_to_drive');

    assert.match(message, /Drive API is switched off/);
    assert.ok(message.includes(consoleUrlFor('drive.googleapis.com')));
    assert.doesNotMatch(message, /predate Drive support/);
});

test('a Drive 403 with the scope granted is passed through', async () => {
    const explain = await explainWith(ALL_SCOPES);
    const message = explain(forbiddenError('The user does not have sufficient permissions for this file.'), 'save_attachment_to_drive');

    assert.equal(message, 'The user does not have sufficient permissions for this file.');
});

test('a Drive 403 on a token without drive.file still gets the re-auth hint', async () => {
    const explain = await explainWith('https://mail.google.com/');
    const message = explain(forbiddenError(), 'save_attachment_to_drive');

    assert.match(message, /predate Drive support/);
});

test('a filter 403 with gmail.settings.basic granted is passed through', async () => {
    const explain = await explainWith(ALL_SCOPES);
    const message = explain(forbiddenError('Filters quota exceeded.'), 'create_filter');

    assert.equal(message, 'Filters quota exceeded.');
});

test('a filter 403 on a token without gmail.settings.basic gets the re-auth hint', async () => {
    const explain = await explainWith('https://mail.google.com/');
    const message = explain(forbiddenError(), 'create_filter');

    assert.match(message, /gmail\.settings\.basic/);
});
