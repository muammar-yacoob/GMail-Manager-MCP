import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLimit } from '../dist/batch.js';

/**
 * `runBatch` was written because a 44-wide burst of writes came back half
 * throttled. The read paths had the same unbounded fan-out and none of the
 * defence: `search_emails` with maxResults 50 fired 50 concurrent
 * `messages.get` calls and surfaced the resulting 429s as a failed search.
 * `mapLimit` is that fix, so these check the two properties it exists for.
 */

const throttled = () => Object.assign(new Error('Rate Limit Exceeded'), { code: 429 });

test('never runs more than the limit at once', async () => {
    let inFlight = 0;
    let peak = 0;

    await mapLimit(
        Array.from({ length: 50 }, (_, i) => i),
        async (n) => {
            inFlight++;
            peak = Math.max(peak, inFlight);
            await new Promise((r) => setTimeout(r, 1));
            inFlight--;
            return n;
        },
        { concurrency: 5 }
    );

    assert.ok(peak <= 5, `ran ${peak} at once, which is the burst this exists to prevent`);
});

test('results come back in the order they went in', async () => {
    const results = await mapLimit(
        ['a', 'b', 'c', 'd'],
        // Reverse the durations so completion order is not input order.
        async (item, index) => {
            await new Promise((r) => setTimeout(r, (4 - index) * 2));
            return item.toUpperCase();
        },
        { concurrency: 4 }
    );

    assert.deepEqual(results, ['A', 'B', 'C', 'D']);
});

test('retries a throttled call instead of failing the whole read', async () => {
    let attempts = 0;

    const results = await mapLimit(
        ['only'],
        async (item) => {
            attempts++;
            if (attempts < 3) throw throttled();
            return item;
        },
        { concurrency: 1 }
    );

    assert.deepEqual(results, ['only']);
    assert.equal(attempts, 3);
});

test('a genuine error is not retried, and is not swallowed', async () => {
    let attempts = 0;

    await assert.rejects(
        mapLimit(
            ['bad'],
            async () => {
                attempts++;
                throw Object.assign(new Error('Not Found'), { code: 404 });
            },
            { concurrency: 1 }
        ),
        /Not Found/
    );

    assert.equal(attempts, 1, 'retrying a 404 only burns time');
});

/**
 * The difference from `runBatch`, and the reason both exist: a batch of writes
 * reports which ones failed and carries on, but a read is assembling one answer
 * out of every part, and a silent hole in it is not an answer.
 */
test('one failed part fails the whole read', async () => {
    await assert.rejects(
        mapLimit(['a', 'b', 'c'], async (item) => {
            if (item === 'b') throw Object.assign(new Error('gone'), { code: 404 });
            return item;
        }),
        /gone/
    );
});

test('an empty list is not a special case', async () => {
    assert.deepEqual(await mapLimit([], async () => 'never'), []);
});
