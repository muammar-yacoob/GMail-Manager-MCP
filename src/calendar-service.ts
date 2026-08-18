import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

/** Maps our tool-facing notification levels onto the API's `sendUpdates`. */
export type NotificationLevel = 'all' | 'externalOnly' | 'none';

export interface EventAttendeeInput {
    email: string;
    displayName?: string;
    optional?: boolean;
    responseStatus?: string;
}

export interface CreateEventInput {
    calendarId?: string;
    summary: string;
    startTime: string;
    endTime: string;
    allDay?: boolean;
    timeZone?: string;
    description?: string;
    location?: string;
    attendees?: EventAttendeeInput[];
    recurrence?: string[];
    addGoogleMeetUrl?: boolean;
    availability?: 'busy' | 'free';
    visibility?: 'default' | 'public' | 'private';
    colorId?: string;
    reminders?: Array<{ method: 'email' | 'popup'; minutes: number }>;
    guestsCanInviteOthers?: boolean;
    guestsCanModify?: boolean;
    guestsCanSeeOtherGuests?: boolean;
    eventType?: string;
    notificationLevel?: NotificationLevel;
}

export interface UpdateEventInput extends Partial<Omit<CreateEventInput, 'summary' | 'startTime' | 'endTime'>> {
    eventId: string;
    summary?: string;
    startTime?: string;
    endTime?: string;
    addedAttendees?: EventAttendeeInput[];
    removedAttendeeEmails?: string[];
}

export interface ListEventsInput {
    calendarId?: string;
    startTime?: string;
    endTime?: string;
    query?: string;
    maxResults?: number;
    orderBy?: 'startTime' | 'updated';
    singleEvents?: boolean;
    timeZone?: string;
    eventTypes?: string[];
    pageToken?: string;
}

export interface FreeSlot {
    start: string;
    end: string;
}

/** An all-day event uses `date`; a timed one uses `dateTime`. */
function toEventTime(
    value: string,
    allDay: boolean | undefined,
    timeZone: string | undefined
): calendar_v3.Schema$EventDateTime {
    if (allDay) {
        // Calendar wants a bare YYYY-MM-DD for all-day events, and rejects a
        // full timestamp, so take the date portion of whatever we were handed.
        return { date: value.slice(0, 10) };
    }
    return timeZone ? { dateTime: value, timeZone } : { dateTime: value };
}

function attendeesToApi(list: EventAttendeeInput[] | undefined): calendar_v3.Schema$EventAttendee[] | undefined {
    return list?.map((a) => ({
        email: a.email,
        displayName: a.displayName,
        optional: a.optional,
        responseStatus: a.responseStatus
    }));
}

export class CalendarService {
    private calendar: calendar_v3.Calendar;
    /** Cached so respond_to_event does not re-fetch the profile on every call. */
    private primaryEmail: string | null = null;

    constructor(auth: OAuth2Client) {
        this.calendar = google.calendar({ version: 'v3', auth });
    }

    /**
     * The signed-in user's own address.
     *
     * respond_to_event has to know which attendee row is "me" before it can set
     * a response status, and guessing from the organiser is wrong whenever the
     * user was merely invited.
     */
    async getPrimaryEmail(): Promise<string> {
        if (this.primaryEmail) return this.primaryEmail;
        const { data } = await this.calendar.calendars.get({ calendarId: 'primary' });
        this.primaryEmail = data.id || '';
        return this.primaryEmail;
    }

    async listCalendars(pageSize = 100, pageToken?: string) {
        const { data } = await this.calendar.calendarList.list({ maxResults: pageSize, pageToken });
        return {
            calendars: (data.items || []).map((c) => ({
                id: c.id || '',
                summary: c.summary || '',
                description: c.description || '',
                timeZone: c.timeZone || '',
                primary: Boolean(c.primary),
                accessRole: c.accessRole || ''
            })),
            nextPageToken: data.nextPageToken || undefined
        };
    }

    async listEvents(input: ListEventsInput = {}) {
        const { data } = await this.calendar.events.list({
            calendarId: input.calendarId || 'primary',
            timeMin: input.startTime,
            timeMax: input.endTime,
            q: input.query,
            maxResults: input.maxResults ?? 25,
            // Expanding recurrences is what makes `orderBy: startTime` legal and
            // makes "what is on next Tuesday" answerable at all.
            singleEvents: input.singleEvents ?? true,
            orderBy: input.orderBy ?? 'startTime',
            timeZone: input.timeZone,
            eventTypes: input.eventTypes,
            pageToken: input.pageToken
        });
        return {
            events: (data.items || []).map((e) => this.summarise(e)),
            nextPageToken: data.nextPageToken || undefined
        };
    }

    /**
     * Keyword search over events.
     *
     * The connector this replaces called its version "semantic"; the Calendar
     * API only offers full-text `q`, so this matches on title, description,
     * location and attendees rather than meaning. Same inputs, same shape of
     * answer, and honest about what it does.
     */
    async searchEvents(query: string, maxResults = 25, calendarId = 'primary', pageToken?: string) {
        return this.listEvents({ calendarId, query, maxResults, pageToken, orderBy: 'startTime' });
    }

    async getEvent(eventId: string, calendarId = 'primary') {
        const { data } = await this.calendar.events.get({ calendarId, eventId });
        return this.detail(data);
    }

    async createEvent(input: CreateEventInput) {
        const requestBody: calendar_v3.Schema$Event = {
            summary: input.summary,
            description: input.description,
            location: input.location,
            start: toEventTime(input.startTime, input.allDay, input.timeZone),
            end: toEventTime(input.endTime, input.allDay, input.timeZone),
            attendees: attendeesToApi(input.attendees),
            recurrence: input.recurrence,
            colorId: input.colorId,
            visibility: input.visibility,
            transparency: input.availability === 'free' ? 'transparent' : input.availability === 'busy' ? 'opaque' : undefined,
            eventType: input.eventType,
            guestsCanInviteOthers: input.guestsCanInviteOthers,
            guestsCanModify: input.guestsCanModify,
            guestsCanSeeOtherGuests: input.guestsCanSeeOtherGuests,
            reminders: input.reminders?.length
                ? { useDefault: false, overrides: input.reminders }
                : undefined
        };

        if (input.addGoogleMeetUrl) {
            requestBody.conferenceData = {
                createRequest: {
                    // Calendar requires a caller-supplied idempotency key here.
                    requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
            };
        }

        const { data } = await this.calendar.events.insert({
            calendarId: input.calendarId || 'primary',
            requestBody,
            sendUpdates: input.notificationLevel,
            conferenceDataVersion: input.addGoogleMeetUrl ? 1 : 0
        });
        return this.detail(data);
    }

    async updateEvent(input: UpdateEventInput) {
        const calendarId = input.calendarId || 'primary';

        // Attendee edits are relative ("add these, drop those"), so the current
        // list has to be read before it can be rewritten. Everything else is a
        // straight field patch.
        let attendees: calendar_v3.Schema$EventAttendee[] | undefined;
        if (input.attendees) {
            attendees = attendeesToApi(input.attendees);
        } else if (input.addedAttendees?.length || input.removedAttendeeEmails?.length) {
            const { data: current } = await this.calendar.events.get({ calendarId, eventId: input.eventId });
            const removed = new Set((input.removedAttendeeEmails || []).map((e) => e.toLowerCase()));
            attendees = [
                ...(current.attendees || []).filter((a) => !removed.has((a.email || '').toLowerCase())),
                ...(attendeesToApi(input.addedAttendees) || [])
            ];
        }

        const requestBody: calendar_v3.Schema$Event = {
            summary: input.summary,
            description: input.description,
            location: input.location,
            start: input.startTime ? toEventTime(input.startTime, input.allDay, input.timeZone) : undefined,
            end: input.endTime ? toEventTime(input.endTime, input.allDay, input.timeZone) : undefined,
            attendees,
            recurrence: input.recurrence,
            colorId: input.colorId,
            visibility: input.visibility,
            transparency: input.availability === 'free' ? 'transparent' : input.availability === 'busy' ? 'opaque' : undefined,
            guestsCanInviteOthers: input.guestsCanInviteOthers,
            guestsCanModify: input.guestsCanModify,
            guestsCanSeeOtherGuests: input.guestsCanSeeOtherGuests,
            reminders: input.reminders?.length
                ? { useDefault: false, overrides: input.reminders }
                : undefined
        };

        if (input.addGoogleMeetUrl) {
            requestBody.conferenceData = {
                createRequest: {
                    requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
                    conferenceSolutionKey: { type: 'hangoutsMeet' }
                }
            };
        }

        // patch, not update: update replaces the whole resource, so any field we
        // did not send would be wiped off the event.
        const { data } = await this.calendar.events.patch({
            calendarId,
            eventId: input.eventId,
            requestBody,
            sendUpdates: input.notificationLevel,
            conferenceDataVersion: input.addGoogleMeetUrl ? 1 : 0
        });
        return this.detail(data);
    }

    async deleteEvent(eventId: string, calendarId = 'primary', notificationLevel?: NotificationLevel) {
        await this.calendar.events.delete({ calendarId, eventId, sendUpdates: notificationLevel });
    }

    /**
     * Set your own RSVP on an event.
     *
     * Only the attendee row matching the signed-in user may be touched, so the
     * row is located by `self` first and by address second. Patching the whole
     * attendee list is the documented way to do this.
     */
    async respondToEvent(
        eventId: string,
        responseStatus: 'accepted' | 'declined' | 'tentative',
        options: { calendarId?: string; comment?: string; notificationLevel?: NotificationLevel } = {}
    ) {
        const calendarId = options.calendarId || 'primary';
        const { data: event } = await this.calendar.events.get({ calendarId, eventId });
        const attendees = event.attendees || [];

        if (!attendees.length) {
            throw new Error(
                `Event ${eventId} has no attendees, so there is nothing to respond to. ` +
                `Events you created without guests do not carry an RSVP.`
            );
        }

        const me = (await this.getPrimaryEmail()).toLowerCase();
        const mine = attendees.find((a) => a.self) ?? attendees.find((a) => (a.email || '').toLowerCase() === me);
        if (!mine) {
            throw new Error(
                `You are not on the attendee list for event ${eventId}, so you cannot RSVP to it.`
            );
        }

        mine.responseStatus = responseStatus;
        if (options.comment !== undefined) mine.comment = options.comment;

        const { data } = await this.calendar.events.patch({
            calendarId,
            eventId,
            requestBody: { attendees },
            sendUpdates: options.notificationLevel
        });
        return this.detail(data);
    }

    /**
     * Free windows common to every listed attendee.
     *
     * There is no Calendar endpoint that does this, so it is built on
     * `freebusy.query`: take everyone's busy blocks, merge them, invert inside
     * the requested range, then keep the gaps that are long enough and fall
     * inside the caller's working hours.
     */
    async suggestTime(input: {
        attendeeEmails: string[];
        startTime: string;
        endTime: string;
        durationMinutes?: number;
        timeZone?: string;
        startHour?: string;
        endHour?: string;
        excludeWeekends?: boolean;
        maxResults?: number;
    }): Promise<FreeSlot[]> {
        const durationMs = (input.durationMinutes ?? 30) * 60_000;
        const rangeStart = new Date(input.startTime).getTime();
        const rangeEnd = new Date(input.endTime).getTime();
        if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
            throw new Error('suggest_time needs a valid ISO 8601 range with endTime after startTime.');
        }

        const timeZone = input.timeZone || (await this.primaryTimeZone());

        const { data } = await this.calendar.freebusy.query({
            requestBody: {
                timeMin: new Date(rangeStart).toISOString(),
                timeMax: new Date(rangeEnd).toISOString(),
                timeZone,
                items: input.attendeeEmails.map((id) => ({ id }))
            }
        });

        // A calendar we are not allowed to read reports an error rather than
        // busy blocks. Treating that as "free" would suggest slots that are not
        // actually free, so say so instead.
        const unreadable = Object.entries(data.calendars || {})
            .filter(([, v]) => (v.errors || []).length)
            .map(([id, v]) => `${id} (${v.errors?.[0]?.reason})`);
        if (unreadable.length === input.attendeeEmails.length) {
            throw new Error(`Cannot read free/busy for any attendee: ${unreadable.join(', ')}`);
        }

        const busy: Array<[number, number]> = [];
        for (const cal of Object.values(data.calendars || {})) {
            for (const b of cal.busy || []) {
                if (b.start && b.end) busy.push([new Date(b.start).getTime(), new Date(b.end).getTime()]);
            }
        }

        // Merge overlapping busy blocks so the inversion below is a clean sweep.
        busy.sort((a, b) => a[0] - b[0]);
        const merged: Array<[number, number]> = [];
        for (const [s, e] of busy) {
            const last = merged[merged.length - 1];
            if (last && s <= last[1]) last[1] = Math.max(last[1], e);
            else merged.push([s, e]);
        }

        // Invert: the gaps between busy blocks are the candidate free windows.
        const free: Array<[number, number]> = [];
        let cursor = rangeStart;
        for (const [s, e] of merged) {
            if (s > cursor) free.push([cursor, Math.min(s, rangeEnd)]);
            cursor = Math.max(cursor, e);
            if (cursor >= rangeEnd) break;
        }
        if (cursor < rangeEnd) free.push([cursor, rangeEnd]);

        const slots: FreeSlot[] = [];
        const limit = input.maxResults ?? 5;
        for (const [s, e] of free) {
            for (const [ws, we] of this.clipToWorkingHours(s, e, timeZone, input)) {
                if (we - ws >= durationMs) {
                    slots.push({ start: new Date(ws).toISOString(), end: new Date(we).toISOString() });
                    if (slots.length >= limit) return slots;
                }
            }
        }
        return slots;
    }

    private async primaryTimeZone(): Promise<string> {
        const { data } = await this.calendar.calendars.get({ calendarId: 'primary' });
        return data.timeZone || 'UTC';
    }

    /**
     * Cut a window down to the requested hours of the day, in the requested
     * zone, dropping weekends when asked. A window spanning several days is
     * split into one piece per day.
     */
    private clipToWorkingHours(
        start: number,
        end: number,
        timeZone: string,
        prefs: { startHour?: string; endHour?: string; excludeWeekends?: boolean }
    ): Array<[number, number]> {
        if (!prefs.startHour && !prefs.endHour && !prefs.excludeWeekends) return [[start, end]];

        const [openH, openM] = (prefs.startHour || '00:00').split(':').map(Number);
        const [closeH, closeM] = (prefs.endHour || '23:59').split(':').map(Number);

        const out: Array<[number, number]> = [];
        let day = this.localParts(start, timeZone);
        // Walk one local day at a time. Ranges here are days, not months, so a
        // bounded loop is plenty.
        for (let guard = 0; guard < 400; guard++) {
            const dayOpen = this.fromLocal(day.year, day.month, day.day, openH, openM, timeZone);
            const dayClose = this.fromLocal(day.year, day.month, day.day, closeH, closeM, timeZone);

            const isWeekend = day.weekday === 0 || day.weekday === 6;
            if (!(prefs.excludeWeekends && isWeekend)) {
                const s = Math.max(start, dayOpen);
                const e = Math.min(end, dayClose);
                if (e > s) out.push([s, e]);
            }

            const nextMidnight = this.fromLocal(day.year, day.month, day.day, 24, 0, timeZone);
            if (nextMidnight >= end) break;
            day = this.localParts(nextMidnight, timeZone);
        }
        return out;
    }

    /** Wall-clock fields of an instant, as seen in `timeZone`. */
    private localParts(ms: number, timeZone: string) {
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour12: false,
            weekday: 'short',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        const parts = Object.fromEntries(
            fmt.formatToParts(new Date(ms)).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
        ) as Record<string, string>;
        const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
        return {
            year: Number(parts.year),
            month: Number(parts.month),
            day: Number(parts.day),
            hour: Number(parts.hour) % 24,
            minute: Number(parts.minute),
            weekday: weekdayIndex
        };
    }

    /**
     * The instant at which the given wall-clock time occurs in `timeZone`.
     *
     * Done by guessing UTC, measuring how far off the zone puts us, and
     * correcting; repeated once so a DST boundary inside the guess still lands
     * on the right side.
     */
    private fromLocal(
        year: number,
        month: number,
        day: number,
        hour: number,
        minute: number,
        timeZone: string
    ): number {
        const target = Date.UTC(year, month - 1, day, hour, minute);
        let guess = target;
        for (let i = 0; i < 2; i++) {
            const p = this.localParts(guess, timeZone);
            const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
            const drift = seen - target;
            if (!drift) break;
            guess -= drift;
        }
        return guess;
    }

    private summarise(e: calendar_v3.Schema$Event) {
        return {
            id: e.id || '',
            summary: e.summary || '(no title)',
            start: e.start?.dateTime || e.start?.date || '',
            end: e.end?.dateTime || e.end?.date || '',
            location: e.location || '',
            attendeeCount: (e.attendees || []).length,
            status: e.status || '',
            htmlLink: e.htmlLink || ''
        };
    }

    private detail(e: calendar_v3.Schema$Event) {
        return {
            ...this.summarise(e),
            description: e.description || '',
            organizer: e.organizer?.email || '',
            hangoutLink: e.hangoutLink || '',
            recurrence: e.recurrence || [],
            recurringEventId: e.recurringEventId || '',
            attendees: (e.attendees || []).map((a) => ({
                email: a.email || '',
                displayName: a.displayName || '',
                responseStatus: a.responseStatus || '',
                optional: Boolean(a.optional),
                organizer: Boolean(a.organizer),
                self: Boolean(a.self)
            }))
        };
    }
}
