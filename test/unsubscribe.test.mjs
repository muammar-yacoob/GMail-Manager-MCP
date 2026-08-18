import test from 'node:test';
import assert from 'node:assert/strict';
import {
    assertPostable,
    canOneClick,
    isPrivateHost,
    oneClickUnsubscribe,
    parseMailto,
    parseUnsubscribeTargets
} from '../dist/unsubscribe.js';

/**
 * The one-click POST is irreversible and outward-facing: firing it at a real
 * sender is the only way to observe it end to end, and doing that unsubscribes
 * the user for real. So fetch is injected and asserted on instead. That also
 * keeps the SSRF guard honest - a live test server would have to live on
 * localhost, which the guard is supposed to refuse.
 */
function recordingFetch(status = 200) {
    const calls = [];
    const fetchImpl = async (url, init) => {
        calls.push({ url, init });
        // A real Response also carries a body. Not modelling one is the point:
        // nothing here should ever read it.
        return { status };
    };
    return { calls, fetchImpl };
}

test('reads both targets out of a List-Unsubscribe header', () => {
    const t = parseUnsubscribeTargets('<mailto:leave@news.example?subject=unsub-9f3a>, <https://news.example/opt-out?t=9f3a>');
    assert.equal(t.mailto, 'mailto:leave@news.example?subject=unsub-9f3a');
    assert.equal(t.url, 'https://news.example/opt-out?t=9f3a');
    assert.equal(t.oneClick, false);
});

test('accepts the One-Click declaration whatever spacing and case the sender used', () => {
    for (const header of ['List-Unsubscribe=One-Click', 'list-unsubscribe=one-click', '  List-Unsubscribe = One-Click  ']) {
        assert.equal(parseUnsubscribeTargets('<https://x.example/u>', header).oneClick, true, header);
    }
});

test('a missing or unrelated Post header is not one-click', () => {
    assert.equal(parseUnsubscribeTargets('<https://x.example/u>').oneClick, false);
    assert.equal(parseUnsubscribeTargets('<https://x.example/u>', 'List-Unsubscribe=Two-Click').oneClick, false);
});

test('one-click needs https, not just the declaration', () => {
    assert.equal(canOneClick(parseUnsubscribeTargets('<https://x.example/u>', 'List-Unsubscribe=One-Click')), true);
    assert.equal(canOneClick(parseUnsubscribeTargets('<http://x.example/u>', 'List-Unsubscribe=One-Click')), false);
    assert.equal(canOneClick(parseUnsubscribeTargets('<mailto:x@y.example>', 'List-Unsubscribe=One-Click')), false);
});

test('keeps the subscription token that mailto opt-outs carry in the query', () => {
    const m = parseMailto('mailto:leave@news.example?subject=unsub-9f3a&body=remove%20me');
    assert.equal(m.to, 'leave@news.example');
    assert.equal(m.subject, 'unsub-9f3a');
    assert.equal(m.body, 'remove me');
});

test('falls back to a sane subject and body when the mailto carries none', () => {
    const m = parseMailto('mailto:unsubscribe@news.example');
    assert.equal(m.to, 'unsubscribe@news.example');
    assert.equal(m.subject, 'unsubscribe');
    assert.ok(m.body.length > 0);
});

test('survives a mailto the sender encoded badly', () => {
    const m = parseMailto('mailto:leave%ZZ@news.example?subject=unsub-9f3a');
    assert.equal(m.to, 'leave%ZZ@news.example');
    assert.equal(m.subject, 'unsub-9f3a');
});

test('recognises addresses that point back inside the network', () => {
    for (const host of ['localhost', 'router.local', 'db.internal', '127.0.0.1', '10.1.2.3', '192.168.0.1',
        '172.16.0.1', '172.31.255.255', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00:1::1', 'fe80::1']) {
        assert.equal(isPrivateHost(host), true, host);
    }
    for (const host of ['news.example', 'fdmail.example.com', '172.32.0.1', '8.8.8.8', 'local.example.com']) {
        assert.equal(isPrivateHost(host), false, host);
    }
});

test('refuses to POST anywhere but a public https endpoint', () => {
    assert.throws(() => assertPostable('http://news.example/u'), /https/);
    assert.throws(() => assertPostable('https://169.254.169.254/latest/meta-data/'), /private address/);
    assert.throws(() => assertPostable('not a url'), /valid URL/);
    assert.equal(assertPostable('https://news.example/u').hostname, 'news.example');
});

/**
 * isPrivateHost is only ever reached through a parsed URL, and URL.hostname
 * keeps the brackets on an IPv6 literal. Testing the helper on bare strings
 * missed that entirely, so these go in through the front door instead.
 */
test('vets the hostname in the form a parsed URL actually produces', () => {
    for (const url of ['https://[::1]/u', 'https://[fd00::1]/u', 'https://[fe80::1]/u']) {
        assert.throws(() => assertPostable(url), /private address/, url);
    }
    // Decimal and hex literals are normalised to a dotted quad before the check.
    for (const url of ['https://2130706433/u', 'https://0x7f000001/u']) {
        assert.throws(() => assertPostable(url), /private address/, url);
    }
    assert.equal(assertPostable('https://[2606:4700::1111]/u').hostname, '[2606:4700::1111]');
});

test('sends exactly the request RFC 8058 specifies', async () => {
    const { calls, fetchImpl } = recordingFetch();
    const result = await oneClickUnsubscribe('https://news.example/opt-out?t=9f3a', fetchImpl);

    assert.equal(calls.length, 1);
    const { url, init } = calls[0];
    assert.equal(url, 'https://news.example/opt-out?t=9f3a');
    assert.equal(init.method, 'POST');
    assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded');
    assert.equal(init.body, 'List-Unsubscribe=One-Click');
    // A 3xx would otherwise be chased to a host the guard never vetted.
    assert.equal(init.redirect, 'manual');
    assert.ok(init.signal, 'a hung endpoint must not hang the tool');
    assert.deepEqual(result, { status: 200, ok: true });
});

test('treats a redirect as success and a server error as failure', async () => {
    const redirect = await oneClickUnsubscribe('https://news.example/u', recordingFetch(302).fetchImpl);
    assert.deepEqual(redirect, { status: 302, ok: true });

    const failed = await oneClickUnsubscribe('https://news.example/u', recordingFetch(500).fetchImpl);
    assert.deepEqual(failed, { status: 500, ok: false });
});

test('never requests a URL the guard rejected', async () => {
    const { calls, fetchImpl } = recordingFetch();
    await assert.rejects(() => oneClickUnsubscribe('https://127.0.0.1/u', fetchImpl));
    assert.equal(calls.length, 0);
});
