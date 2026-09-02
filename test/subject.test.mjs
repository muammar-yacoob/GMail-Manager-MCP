import test from 'node:test';
import assert from 'node:assert/strict';
import { tidySubject } from '../dist/gmail-service.js';

/**
 * Long threads accrete a prefix per hop. The Stockport Homes thread reached
 * "RE: RE: External: RE: Request for bond scheme ..." in four exchanges, which
 * on a phone pushes the actual subject off the preview line entirely.
 */
test('collapses a stacked reply chain to one Re:', () => {
    assert.equal(
        tidySubject('RE: RE: External: RE: Request for bond scheme', 'reply'),
        'Re: Request for bond scheme'
    );
    assert.equal(tidySubject('Re: Re: Re: Hello', 'reply'), 'Re: Hello');
});

test('adds a prefix when there is none', () => {
    assert.equal(tidySubject('Our Ref: Ismail/Nasher 44161', 'reply'), 'Re: Our Ref: Ismail/Nasher 44161');
});

test('keeps a colon that belongs to the subject itself', () => {
    assert.equal(tidySubject('Our Ref: 44161', 'none'), 'Our Ref: 44161');
});

test('forwarding wins over replying', () => {
    assert.equal(tidySubject('Re: Fwd: Re: Your valuation', 'forward'), 'Fwd: Your valuation');
    assert.equal(tidySubject('FW: Re: Your valuation'), 'Fwd: Your valuation');
});

test('strips gateway banners without claiming a reply', () => {
    assert.equal(tidySubject('External: Payroll'), 'Payroll');
    assert.equal(tidySubject('[EXTERNAL] Payroll'), 'Payroll');
});

test('numbered prefixes and localised ones', () => {
    assert.equal(tidySubject('Re[2]: Budget', 'reply'), 'Re: Budget');
    assert.equal(tidySubject('AW: WG: Rechnung'), 'Fwd: Rechnung');
});

test('is idempotent', () => {
    const once = tidySubject('RE: RE: Thing', 'reply');
    assert.equal(tidySubject(once, 'reply'), once);
    assert.equal(tidySubject(once), once);
});

test('never returns a bare prefix or empty subject', () => {
    assert.equal(tidySubject('Re:', 'reply'), 'Re:');
    assert.equal(tidySubject('', 'reply'), '');
    assert.equal(tidySubject(undefined), '');
});
