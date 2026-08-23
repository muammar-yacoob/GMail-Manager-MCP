import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addressesOf, loadAttachments, MAX_MESSAGE_BYTES } from '../dist/gmail-service.js';

/**
 * The self-addressed-draft check is only as good as the address parser behind
 * it. A `To:` header is display-name soup, and comparing it as a whole string
 * is exactly how a draft addressed back to the sender slipped through: the
 * account is `me@x.com`, the header reads `Me <me@x.com>`, and the two are not
 * equal as strings.
 */
test('addressesOf pulls bare addresses out of a header', () => {
    assert.deepEqual(addressesOf('me@x.com'), ['me@x.com']);
    assert.deepEqual(addressesOf('Me <me@x.com>'), ['me@x.com']);
    assert.deepEqual(addressesOf('"Yacoob, M" <me@x.com>'), ['me@x.com']);
    assert.deepEqual(addressesOf('A <a@x.com>, b@y.com'), ['a@x.com', 'b@y.com']);
});

test('addressesOf lower-cases, so casing cannot defeat the self check', () => {
    assert.deepEqual(addressesOf('Me <ME@X.COM>'), ['me@x.com']);
});

test('addressesOf treats absent headers as no recipients', () => {
    assert.deepEqual(addressesOf(''), []);
    assert.deepEqual(addressesOf(undefined), []);
    assert.deepEqual(addressesOf(null), []);
});

/**
 * Gmail measures the encoded message, not the files on disk. A 20 MB
 * attachment is under the advertised 25 MB limit right up until base64 turns
 * it into 27 MB, and the resulting rejection from Google says nothing about
 * encoding. Refusing it here, with the arithmetic shown, is the difference
 * between an actionable error and a mystery.
 */
test('loadAttachments refuses files Gmail would reject once encoded', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gmm-'));
    const big = join(dir, 'big.bin');
    await writeFile(big, Buffer.alloc(20 * 1024 * 1024));

    await assert.rejects(() => loadAttachments([big]), (err) => {
        assert.match(err.message, /25 MB/);
        assert.match(err.message, /20\.0 MB on disk/);
        assert.match(err.message, /27\.\d MB/);
        return true;
    });
});

test('loadAttachments accepts a file that fits, and types it by extension', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gmm-'));
    const small = join(dir, 'note.txt');
    await writeFile(small, 'hello');

    const [loaded] = await loadAttachments([small]);
    assert.equal(loaded.filename, 'note.txt');
    assert.equal(loaded.mimeType, 'text/plain');
    assert.equal(loaded.content.toString(), 'hello');
});

test('loadAttachments names the file it could not find', async () => {
    await assert.rejects(
        () => loadAttachments([join(tmpdir(), 'gmm-definitely-absent.pdf')]),
        /Attachment not found:.*gmm-definitely-absent\.pdf/
    );
});

test('the limit is Gmail\'s stated 25 MB', () => {
    assert.equal(MAX_MESSAGE_BYTES, 25 * 1024 * 1024);
});
