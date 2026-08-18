import test from 'node:test';
import assert from 'node:assert/strict';
import { CalendarService } from '../dist/calendar-service.js';

/**
 * suggest_time has no Calendar API equivalent: the free-slot maths is ours, so
 * it is the part worth testing. The API surface it touches is stubbed, which
 * keeps these runnable without credentials.
 */
function serviceWith(busyByCalendar) {
    const svc = new CalendarService({});
    svc.calendar = {
        freebusy: { query: async () => ({ data: { calendars: busyByCalendar } }) },
        calendars: { get: async () => ({ data: { id: 'me@example.com', timeZone: 'Europe/London' } }) }
    };
    svc.primaryEmail = 'me@example.com';
    return svc;
}

const busy = (start, end) => ({ start, end });

test('merges overlapping busy blocks across attendees and returns the gaps', async () => {
    const svc = serviceWith({
        'a@example.com': { busy: [busy('2026-08-20T09:00:00Z', '2026-08-20T10:00:00Z')] },
        'b@example.com': { busy: [busy('2026-08-20T09:30:00Z', '2026-08-20T11:00:00Z')] }
    });
    const slots = await svc.suggestTime({
        attendeeEmails: ['a@example.com', 'b@example.com'],
        startTime: '2026-08-20T08:00:00Z',
        endTime: '2026-08-20T13:00:00Z',
        durationMinutes: 60,
        timeZone: 'UTC'
    });
    assert.equal(slots[0].start, '2026-08-20T08:00:00.000Z');
    assert.equal(slots[0].end, '2026-08-20T09:00:00.000Z');
    // 09:00-11:00 is busy once merged, so the next free run starts at 11:00
    assert.equal(slots[1].start, '2026-08-20T11:00:00.000Z');
});

test('drops gaps shorter than the requested duration', async () => {
    const svc = serviceWith({
        'a@example.com': { busy: [busy('2026-08-20T09:00:00Z', '2026-08-20T10:00:00Z')] },
        'b@example.com': { busy: [busy('2026-08-20T09:30:00Z', '2026-08-20T11:00:00Z')] }
    });
    const slots = await svc.suggestTime({
        attendeeEmails: ['a@example.com', 'b@example.com'],
        startTime: '2026-08-20T08:00:00Z',
        endTime: '2026-08-20T13:00:00Z',
        durationMinutes: 90,
        timeZone: 'UTC'
    });
    assert.ok(!slots.some(s => s.start === '2026-08-20T08:00:00.000Z'), 'the 60-minute gap should not qualify');
});

test('clips to working hours in the requested zone, during BST', async () => {
    const svc = serviceWith({ 'a@example.com': { busy: [] } });
    const [slot] = await svc.suggestTime({
        attendeeEmails: ['a@example.com'],
        startTime: '2026-08-20T00:00:00Z',
        endTime: '2026-08-20T23:59:00Z',
        durationMinutes: 30,
        timeZone: 'Europe/London',
        startHour: '09:00',
        endHour: '17:00'
    });
    // London is UTC+1 in August
    assert.equal(slot.start, '2026-08-20T08:00:00.000Z');
    assert.equal(slot.end, '2026-08-20T16:00:00.000Z');
});

test('clips to working hours in the requested zone, during GMT', async () => {
    const svc = serviceWith({ 'a@example.com': { busy: [] } });
    const [slot] = await svc.suggestTime({
        attendeeEmails: ['a@example.com'],
        startTime: '2026-01-20T00:00:00Z',
        endTime: '2026-01-20T23:59:00Z',
        durationMinutes: 30,
        timeZone: 'Europe/London',
        startHour: '09:00',
        endHour: '17:00'
    });
    // No offset in January, so the wall clock and UTC agree
    assert.equal(slot.start, '2026-01-20T09:00:00.000Z');
});

test('excludeWeekends skips Saturday and Sunday but keeps the days either side', async () => {
    const svc = serviceWith({ 'a@example.com': { busy: [] } });
    const slots = await svc.suggestTime({
        attendeeEmails: ['a@example.com'],
        startTime: '2026-08-21T00:00:00Z', // Friday
        endTime: '2026-08-24T23:59:00Z',   // Monday
        durationMinutes: 30,
        timeZone: 'Europe/London',
        startHour: '09:00',
        endHour: '17:00',
        excludeWeekends: true,
        maxResults: 10
    });
    const days = slots.map(s => s.start.slice(0, 10));
    assert.deepEqual(days, ['2026-08-21', '2026-08-24']);
});

test('reports unreadable calendars instead of treating them as free', async () => {
    const svc = serviceWith({ 'a@example.com': { errors: [{ reason: 'notFound' }] } });
    await assert.rejects(
        () => svc.suggestTime({
            attendeeEmails: ['a@example.com'],
            startTime: '2026-08-20T08:00:00Z',
            endTime: '2026-08-20T13:00:00Z'
        }),
        /Cannot read free\/busy/
    );
});

test('rejects a range that ends before it starts', async () => {
    const svc = serviceWith({ 'a@example.com': { busy: [] } });
    await assert.rejects(
        () => svc.suggestTime({
            attendeeEmails: ['a@example.com'],
            startTime: '2026-08-20T13:00:00Z',
            endTime: '2026-08-20T08:00:00Z'
        }),
        /endTime after startTime/
    );
});
