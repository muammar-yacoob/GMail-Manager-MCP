import test from 'node:test';
import assert from 'node:assert/strict';
import { MailboxCache } from '../dist/cache.js';
import { GmailService } from '../dist/gmail-service.js';

/**
 * The cache is only worth having if it cannot go stale, so that is what these
 * test. Speed is easy to check by eye; the freshness invariant is the part that
 * would fail quietly and hand somebody an inbox missing the message that just
 * arrived.
 *
 * Everything runs against a fake mailbox rather than Gmail, so it needs no
 * credentials, and the request counters are what the assertions are really
 * about: not "is the answer right" alone, but "was it right without asking".
 */

/**
 * A mailbox that behaves like Gmail's in the ways that matter here: a
 * monotonic historyId, a history feed that replays changes since any earlier
 * value of it, and per-message reads that count.
 */
function fakeMailbox() {
    const calls = { profile: 0, history: 0, list: 0, get: 0, thread: 0, modify: 0 };
    const messages = new Map();
    const records = [];
    let historyId = 100;
    let cursorAgedOut = false;

    const headersOf = (id, m) => [
        { name: 'Subject', value: m.subject },
        { name: 'From', value: m.from },
        { name: 'To', value: m.to },
        { name: 'Date', value: m.date },
        { name: 'Message-ID', value: `<${id}@mail.example>` }
    ];

    const payloadOf = (id, m) => ({
        mimeType: 'text/plain',
        headers: headersOf(id, m),
        body: { data: Buffer.from(m.body).toString('base64url') }
    });

    const api = {
        users: {
            getProfile: async () => {
                calls.profile++;
                return { data: { emailAddress: 'me@example.com', historyId: String(historyId) } };
            },
            history: {
                list: async ({ startHistoryId }) => {
                    calls.history++;
                    if (cursorAgedOut) {
                        const error = new Error('Requested entity was not found.');
                        error.code = 404;
                        throw error;
                    }
                    const since = records.filter((r) => r.at > Number(startHistoryId));
                    return {
                        data: {
                            history: since.map((r) => ({
                                messagesAdded: r.ids.map((id) => ({
                                    message: { id, threadId: messages.get(id)?.threadId ?? `t-${id}` }
                                }))
                            }))
                        }
                    };
                }
            },
            messages: {
                list: async () => {
                    calls.list++;
                    return { data: { messages: [...messages.keys()].map((id) => ({ id })) } };
                },
                get: async ({ id }) => {
                    calls.get++;
                    const m = messages.get(id);
                    if (!m) {
                        const error = new Error('Not Found');
                        error.code = 404;
                        throw error;
                    }
                    return { data: { id, threadId: m.threadId, snippet: m.snippet, payload: payloadOf(id, m) } };
                },
                modify: async () => {
                    calls.modify++;
                    historyId++;
                    return { data: {} };
                }
            },
            threads: {
                get: async ({ id }) => {
                    calls.thread++;
                    const inThread = [...messages.entries()].filter(([, m]) => m.threadId === id);
                    return {
                        data: {
                            messages: inThread.map(([mid, m]) => ({
                                id: mid,
                                threadId: id,
                                snippet: m.snippet,
                                payload: payloadOf(mid, m)
                            }))
                        }
                    };
                }
            }
        }
    };

    return {
        api,
        calls,
        /** Put a message in the mailbox and advance history, as a delivery would. */
        deliver(id, fields = {}) {
            messages.set(id, {
                threadId: fields.threadId ?? `t-${id}`,
                subject: fields.subject ?? `Subject ${id}`,
                from: fields.from ?? 'someone@example.com',
                to: fields.to ?? 'me@example.com',
                date: fields.date ?? 'Thu, 28 Aug 2026 09:00:00 +0000',
                snippet: fields.snippet ?? `snippet ${id}`,
                body: fields.body ?? `body of ${id}`
            });
            historyId++;
            records.push({ at: historyId, ids: [id] });
        },
        /** Make the next history.list behave like a cursor Gmail has aged out. */
        ageOutHistory() {
            cursorAgedOut = true;
            historyId++;
        },
        reset() {
            for (const key of Object.keys(calls)) calls[key] = 0;
        }
    };
}

function serviceOn(box, cache = new MailboxCache('memory')) {
    const service = new GmailService({}, cache);
    service.gmail = box.api;
    return service;
}

// --- The freshness guarantee ------------------------------------------------

test('a message that arrives between two searches is in the second one', async () => {
    const box = fakeMailbox();
    box.deliver('m1');
    const gmail = serviceOn(box);

    const before = await gmail.searchEmails('in:inbox', 10);
    assert.deepEqual(before.map((e) => e.id), ['m1']);

    box.deliver('m2', { subject: 'Just arrived' });

    const after = await gmail.searchEmails('in:inbox', 10);
    assert.deepEqual(after.map((e) => e.id).sort(), ['m1', 'm2']);
    assert.equal(after.find((e) => e.id === 'm2').subject, 'Just arrived');
});

test('mail the user sends is picked up the same way mail they receive is', async () => {
    const box = fakeMailbox();
    box.deliver('sent-1', { from: 'me@example.com', to: 'them@example.com' });
    const gmail = serviceOn(box);

    assert.deepEqual((await gmail.searchEmails('in:sent', 10)).map((e) => e.id), ['sent-1']);

    box.deliver('sent-2', { from: 'me@example.com', to: 'them@example.com', subject: 'Follow-up' });

    const after = await gmail.searchEmails('in:sent', 10);
    assert.deepEqual(after.map((e) => e.id).sort(), ['sent-1', 'sent-2']);
});

test('a repeated search re-lists whenever anything at all has changed', async () => {
    const box = fakeMailbox();
    box.deliver('m1');
    const gmail = serviceOn(box);

    await gmail.searchEmails('in:inbox', 10);
    box.deliver('m2');
    box.reset();

    await gmail.searchEmails('in:inbox', 10);
    assert.equal(box.calls.list, 1, 'the id list must come from Gmail once the mailbox has moved');
});

// --- What the cache actually saves ------------------------------------------

test('a repeated search over an untouched mailbox costs one request', async () => {
    const box = fakeMailbox();
    for (const id of ['m1', 'm2', 'm3']) box.deliver(id);
    const gmail = serviceOn(box);

    const first = await gmail.searchEmails('in:inbox', 10);
    assert.equal(box.calls.get, 3, 'the first search fetches each result');

    box.reset();
    const second = await gmail.searchEmails('in:inbox', 10);

    assert.deepEqual(second, first);
    assert.equal(box.calls.profile, 1, 'one cheap probe establishes nothing has changed');
    assert.equal(box.calls.list, 0);
    assert.equal(box.calls.get, 0);
});

test('after a delivery only the new message is fetched', async () => {
    const box = fakeMailbox();
    for (const id of ['m1', 'm2', 'm3']) box.deliver(id);
    const gmail = serviceOn(box);
    await gmail.searchEmails('in:inbox', 10);

    box.deliver('m4');
    box.reset();
    await gmail.searchEmails('in:inbox', 10);

    assert.equal(box.calls.get, 1, 'the three already-seen messages are not re-fetched');
});

test('reading the same message twice fetches it once', async () => {
    const box = fakeMailbox();
    box.deliver('m1', { body: 'the actual body' });
    const gmail = serviceOn(box);

    const first = await gmail.readEmail('m1');
    box.reset();
    const second = await gmail.readEmail('m1');

    assert.equal(second.body, 'the actual body');
    assert.deepEqual(second, first);
    assert.equal(box.calls.get, 0);
});

test('a message read in full satisfies a later search without a fetch', async () => {
    const box = fakeMailbox();
    box.deliver('m1');
    const gmail = serviceOn(box);

    await gmail.readEmail('m1');
    box.reset();

    const results = await gmail.searchEmails('in:inbox', 10);
    assert.equal(results[0].subject, 'Subject m1');
    assert.equal(box.calls.get, 0);
});

/**
 * The search path fetches `format: 'metadata'`, which carries no body. Storing
 * that under the full message would make the next `read_email` return a message
 * whose body is the empty string — a cache that fabricates rather than one that
 * remembers.
 */
test('a search does not leave read_email believing the body is empty', async () => {
    const box = fakeMailbox();
    box.deliver('m1', { body: 'the actual body' });
    const gmail = serviceOn(box);

    await gmail.searchEmails('in:inbox', 10);
    const email = await gmail.readEmail('m1');

    assert.equal(email.body, 'the actual body');
});

// --- Our own writes ---------------------------------------------------------

test('archiving is reflected by the very next search', async () => {
    const box = fakeMailbox();
    box.deliver('m1');
    const gmail = serviceOn(box);
    await gmail.searchEmails('in:inbox', 10);

    await gmail.batchArchive(['m1']);
    box.reset();
    await gmail.searchEmails('in:inbox', 10);

    assert.equal(box.calls.list, 1, 'a cached id list must not survive our own write');
});

// --- Threads ----------------------------------------------------------------

test('a thread that gained a reply is re-read, an untouched one is not', async () => {
    const box = fakeMailbox();
    box.deliver('a1', { threadId: 'conv' });
    box.deliver('b1', { threadId: 'other' });
    const gmail = serviceOn(box);

    await gmail.getThread('conv');
    await gmail.getThread('other');

    box.deliver('a2', { threadId: 'conv', subject: 'Re: Subject a1' });
    box.reset();

    const conversation = await gmail.getThread('conv');
    assert.equal(box.calls.thread, 1, 'the thread that changed is re-read');
    assert.deepEqual(conversation.map((m) => m.id), ['a1', 'a2']);

    box.reset();
    await gmail.getThread('other');
    assert.equal(box.calls.thread, 0, 'a thread nothing touched is still whole');
});

/**
 * The regression this file earned. Reading a thread cheaply — consult the cache
 * first, and only validate if something is there — looks like an obvious
 * saving, and quietly breaks: a thread cached before any history cursor exists
 * has nothing to be checked against, so the next sync has no cursor to replay
 * from and keeps it. The reply never appears.
 */
test('a thread cached before any sync is still checked for replies', async () => {
    const box = fakeMailbox();
    box.deliver('a1', { threadId: 'conv' });
    const gmail = serviceOn(box);

    // First call of the session, so nothing has established a cursor yet.
    await gmail.getThread('conv');
    box.deliver('a2', { threadId: 'conv', subject: 'Re: Subject a1' });

    const conversation = await gmail.getThread('conv');
    assert.deepEqual(conversation.map((m) => m.id), ['a1', 'a2']);
});

test('a message cached before any sync keeps its content', async () => {
    const box = fakeMailbox();
    box.deliver('m1', { body: 'still here' });
    const gmail = serviceOn(box);

    await gmail.readEmail('m1');
    box.deliver('m2');
    await gmail.searchEmails('in:inbox', 10);
    box.reset();

    // Immutable content survives a cursorless start; only threads, which do
    // change, are given up.
    assert.equal((await gmail.readEmail('m1')).body, 'still here');
    assert.equal(box.calls.get, 0);
});

// --- The cache on its own ---------------------------------------------------

const probeOf = (historyId, changes = { messageIds: [], threadIds: [] }, account = 'me@example.com') => ({
    profile: async () => ({ emailAddress: account, historyId }),
    history: async () => changes
});

test('an id list is refused once the mailbox has moved past it', async () => {
    const cache = new MailboxCache('memory');
    await cache.sync(probeOf('100'));
    await cache.putList('in:inbox', 10, '100', ['m1']);

    assert.deepEqual(await cache.getList('in:inbox', 10, '100'), ['m1']);
    assert.equal(await cache.getList('in:inbox', 10, '101'), undefined);
});

test('a history cursor Gmail cannot replay throws the content away', async () => {
    const cache = new MailboxCache('memory');
    await cache.sync(probeOf('100'));
    await cache.putMessage('m1', { id: 'm1', subject: 'kept?', body: 'x' });

    assert.ok(await cache.getMessage('m1'));

    await cache.sync({
        profile: async () => ({ emailAddress: 'me@example.com', historyId: '900' }),
        history: async () => null
    });

    assert.equal(await cache.getMessage('m1'), undefined, 'a gap we cannot see into is not survivable');
});

test('re-authenticating as somebody else empties the cache', async () => {
    const cache = new MailboxCache('memory');
    await cache.sync(probeOf('100'));
    await cache.putMessage('m1', { id: 'm1', subject: 'mine', body: 'x' });

    await cache.sync(probeOf('100', undefined, 'other@example.com'));

    assert.equal(await cache.getMessage('m1'), undefined);
    assert.equal(cache.account, 'other@example.com');
});

test('the history feed drops only what it names', async () => {
    const cache = new MailboxCache('memory');
    await cache.sync(probeOf('100'));
    await cache.putMessage('m1', { id: 'm1', subject: 'touched', body: 'x' });
    await cache.putMessage('m2', { id: 'm2', subject: 'untouched', body: 'y' });

    await cache.sync(probeOf('101', { messageIds: ['m1'], threadIds: [] }));

    assert.equal(await cache.getMessage('m1'), undefined);
    assert.ok(await cache.getMessage('m2'));
});

/**
 * `forget` runs after our own writes. Clearing the cursor as well would look
 * tidy and would quietly stop the next sync replaying the feed, so changes made
 * from another client in the same window would go unnoticed.
 */
test('forgetting after a write keeps the history cursor intact', async () => {
    const cache = new MailboxCache('memory');
    await cache.sync(probeOf('100'));
    await cache.putList('in:inbox', 10, '100', ['m1']);
    await cache.forget(['m1']);

    let replayedFrom;
    await cache.sync({
        profile: async () => ({ emailAddress: 'me@example.com', historyId: '105' }),
        history: async (start) => {
            replayedFrom = start;
            return { messageIds: [], threadIds: [] };
        }
    });

    assert.equal(replayedFrom, '100');
});

test('with caching off nothing is retained', async () => {
    const cache = new MailboxCache('off');
    await cache.putMessage('m1', { id: 'm1', subject: 'x', body: 'y' });
    await cache.putList('in:inbox', 10, '100', ['m1']);

    assert.equal(await cache.getMessage('m1'), undefined);
    assert.equal(await cache.getList('in:inbox', 10, '100'), undefined);
});

test('with caching off a search does not spend a request probing', async () => {
    const box = fakeMailbox();
    box.deliver('m1');
    const gmail = serviceOn(box, new MailboxCache('off'));

    await gmail.searchEmails('in:inbox', 10);

    assert.equal(box.calls.profile, 0);
    assert.equal(box.calls.list, 1);
    assert.equal(box.calls.get, 1);
});
