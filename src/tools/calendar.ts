import { z } from 'zod';
import { defineTools, text } from './registry.js';

const notificationLevel = z
    .enum(['all', 'externalOnly', 'none'])
    .optional()
    .describe("Who gets an email about this change. Default: all attendees");

const calendarId = z
    .string()
    .optional()
    .describe("Calendar ID (an email address), from list_calendars. Default: the primary calendar");

const attendee = z.object({
    email: z.string().describe("Attendee's email address"),
    displayName: z.string().optional().describe("Display name"),
    optional: z.boolean().optional().describe("Whether attendance is optional"),
    responseStatus: z.enum(['needsAction', 'declined', 'tentative', 'accepted']).optional()
        .describe("Their RSVP. Leave unset on new invitations")
});

const reminder = z.object({
    method: z.enum(['email', 'popup']).describe("How the reminder is delivered"),
    minutes: z.number().int().describe("Minutes before the event")
});

/** Shared between create and update, since Calendar treats them identically. */
const eventFields = {
    calendarId,
    description: z.string().optional().describe("Description. May contain HTML"),
    location: z.string().optional().describe("Location"),
    allDay: z.boolean().optional().describe("Whether the event spans whole days rather than a time range"),
    timeZone: z.string().optional().describe("IANA time zone, e.g. 'Europe/London'. Overrides any offset in the timestamps"),
    recurrence: z.array(z.string()).optional().describe("RRULE / RDATE / EXDATE strings per RFC 5545, e.g. ['RRULE:FREQ=WEEKLY;BYDAY=MO']"),
    addGoogleMeetUrl: z.boolean().optional().describe("Attach a Google Meet link"),
    availability: z.enum(['busy', 'free']).optional().describe("Whether the event blocks time. Default: busy"),
    visibility: z.enum(['default', 'public', 'private']).optional().describe("Event visibility"),
    colorId: z.string().optional().describe("Calendar colour ID"),
    reminders: z.array(reminder).optional().describe("Replaces the calendar's default reminders for this event"),
    guestsCanInviteOthers: z.boolean().optional(),
    guestsCanModify: z.boolean().optional(),
    guestsCanSeeOtherGuests: z.boolean().optional(),
    notificationLevel
};

const renderEvent = (e: any) => [
    `Event ID: ${e.id}`,
    `Title: ${e.summary}`,
    `When: ${e.start} to ${e.end}`,
    e.location ? `Where: ${e.location}` : null,
    e.organizer ? `Organiser: ${e.organizer}` : null,
    e.hangoutLink ? `Meet: ${e.hangoutLink}` : null,
    e.recurrence?.length ? `Repeats: ${e.recurrence.join(', ')}` : null,
    e.attendees?.length
        ? `Attendees:\n${e.attendees.map((a: any) => `  - ${a.email}${a.self ? ' (you)' : ''}${a.organizer ? ' [organiser]' : ''}: ${a.responseStatus}`).join('\n')}`
        : null,
    e.description ? `\nDescription:\n${e.description}` : null,
    e.htmlLink ? `\nOpen: ${e.htmlLink}` : null
].filter(Boolean).join('\n');

const renderList = (events: any[], nextPageToken?: string) => {
    if (!events.length) return "No events found.";
    const body = events.map(e => [
        `ID: ${e.id}`,
        `Title: ${e.summary}`,
        `When: ${e.start} to ${e.end}`,
        e.location ? `Where: ${e.location}` : null,
        e.attendeeCount ? `Attendees: ${e.attendeeCount}` : null,
        e.htmlLink ? `Open: ${e.htmlLink}` : null
    ].filter(Boolean).join('\n')).join('\n---\n');
    return nextPageToken ? `${body}\n\nMore results available: pass pageToken='${nextPageToken}'` : body;
};

export const calendarTools = defineTools({
    list_calendars: {
        description: "List the calendars this account can access. Use it to turn a description like 'my family calendar' into the calendar ID other calendar tools take.",
        schema: z.object({
            pageSize: z.number().optional().describe("Max results per page (default 100, max 250)"),
            pageToken: z.string().optional().describe("Token for the next page")
        }),
        handler: async ({ calendar }, v) => {
            const { calendars, nextPageToken } = await calendar.listCalendars(v.pageSize, v.pageToken);
            if (!calendars.length) return text("No calendars found.");
            const body = calendars.map(c =>
                `${c.summary}${c.primary ? ' (primary)' : ''}\n  ID: ${c.id}\n  Time zone: ${c.timeZone}\n  Access: ${c.accessRole}`
            ).join('\n');
            return text(nextPageToken ? `${body}\n\nMore: pageToken='${nextPageToken}'` : body);
        }
    },

    list_events: {
        description: "List events on a calendar, optionally within a time range. Only set a time range when the user asked for one. For open-ended keyword lookups use search_events.",
        schema: z.object({
            calendarId,
            startTime: z.string().optional().describe("Lower bound of the range, ISO 8601. Only set when a timeframe was requested"),
            endTime: z.string().optional().describe("Upper bound of the range, ISO 8601. Must be after startTime"),
            query: z.string().optional().describe("Free-text filter over title, description, location and attendees"),
            maxResults: z.number().optional().describe("Max events to return (default 25)"),
            orderBy: z.enum(['startTime', 'updated']).optional().describe("Sort order. Default: startTime"),
            timeZone: z.string().optional().describe("IANA time zone used to resolve dates without one"),
            eventTypes: z.array(z.enum(['default', 'outOfOffice', 'focusTime', 'workingLocation', 'birthday', 'fromGmail']))
                .optional().describe("Restrict to these event types"),
            pageToken: z.string().optional().describe("Token for the next page")
        }),
        handler: async ({ calendar }, v) => {
            const { events, nextPageToken } = await calendar.listEvents(v);
            return text(renderList(events, nextPageToken));
        }
    },

    search_events: {
        description: "Find events by keyword. Matches text in the title, description, location and attendees.",
        schema: z.object({
            query: z.string().describe("What to search for (case-insensitive)"),
            calendarId,
            pageSize: z.number().optional().describe("Max results (default 25)"),
            pageToken: z.string().optional().describe("Token for the next page")
        }),
        handler: async ({ calendar }, v) => {
            const { events, nextPageToken } = await calendar.searchEvents(v.query, v.pageSize, v.calendarId, v.pageToken);
            return text(renderList(events, nextPageToken));
        }
    },

    get_event: {
        description: "Read one event in full, including attendees and their RSVPs",
        schema: z.object({
            eventId: z.string().describe("Event ID, from list_events or search_events"),
            calendarId
        }),
        handler: async ({ calendar }, v) => text(renderEvent(await calendar.getEvent(v.eventId, v.calendarId)))
    },

    create_event: {
        description: "Create a calendar event. Adding attendees sends them an invitation, so set notificationLevel to 'none' if the event should go in quietly.",
        schema: z.object({
            summary: z.string().describe("Event title"),
            startTime: z.string().describe("Start, ISO 8601, e.g. '2026-08-20T10:00:00+01:00'"),
            endTime: z.string().describe("End, ISO 8601"),
            attendees: z.array(attendee).optional().describe("People to invite"),
            ...eventFields
        }),
        handler: async ({ calendar }, v) => {
            const event = await calendar.createEvent(v);
            return text(`Event created.\n\n${renderEvent(event)}`);
        }
    },

    update_event: {
        description: "Change an existing event. Only the fields you pass are altered; everything else is left alone. Attendees can be edited wholesale via 'attendees', or incrementally via addedAttendees / removedAttendeeEmails.",
        schema: z.object({
            eventId: z.string().describe("Event ID to update"),
            summary: z.string().optional().describe("New title"),
            startTime: z.string().optional().describe("New start, ISO 8601"),
            endTime: z.string().optional().describe("New end, ISO 8601"),
            attendees: z.array(attendee).optional().describe("Replace the whole attendee list"),
            addedAttendees: z.array(attendee).optional().describe("Attendees to add, keeping the existing ones"),
            removedAttendeeEmails: z.array(z.string()).optional().describe("Attendee addresses to remove"),
            ...eventFields
        }),
        handler: async ({ calendar }, v) => {
            const event = await calendar.updateEvent(v);
            return text(`Event updated.\n\n${renderEvent(event)}`);
        }
    },

    delete_event: {
        description: "Delete an event. If it has guests they are notified unless notificationLevel is 'none'.",
        schema: z.object({
            eventId: z.string().describe("Event ID to delete"),
            calendarId,
            notificationLevel
        }),
        handler: async ({ calendar }, v) => {
            await calendar.deleteEvent(v.eventId, v.calendarId, v.notificationLevel);
            return text(`Event ${v.eventId} deleted.`);
        }
    },

    respond_to_event: {
        description: "RSVP to an event you were invited to, as yourself",
        schema: z.object({
            eventId: z.string().describe("Event ID to respond to"),
            responseStatus: z.enum(['accepted', 'declined', 'tentative']).describe("Your response"),
            responseComment: z.string().optional().describe("Comment to attach to the response"),
            calendarId,
            notificationLevel
        }),
        handler: async ({ calendar }, v) => {
            const event = await calendar.respondToEvent(v.eventId, v.responseStatus, {
                calendarId: v.calendarId,
                comment: v.responseComment,
                notificationLevel: v.notificationLevel
            });
            return text(`RSVP set to "${v.responseStatus}".\n\n${renderEvent(event)}`);
        }
    },

    suggest_time: {
        description: "Find times when everyone listed is free, by reading their free/busy data. Attendees whose calendars are not visible to you cannot be checked; if none are readable this reports that rather than guessing.",
        schema: z.object({
            attendeeEmails: z.array(z.string()).min(1).describe("Whose calendars to check. Include yourself if you should be free too"),
            startTime: z.string().describe("Earliest time to consider, ISO 8601"),
            endTime: z.string().describe("Latest time to consider, ISO 8601"),
            durationMinutes: z.number().optional().describe("How long the slot must be (default 30)"),
            timeZone: z.string().optional().describe("IANA time zone for the working-hours filter. Default: your calendar's zone"),
            startHour: z.string().optional().describe("Earliest hour of the day to suggest, as 'HH:mm'"),
            endHour: z.string().optional().describe("Latest hour of the day to suggest, as 'HH:mm'"),
            excludeWeekends: z.boolean().optional().describe("Skip Saturday and Sunday"),
            maxResults: z.number().optional().describe("How many slots to return (default 5)")
        }),
        handler: async ({ calendar }, v) => {
            const slots = await calendar.suggestTime(v);
            if (!slots.length) {
                return text("No free slot of that length in the requested window. Try a longer range, a shorter duration, or relaxing the working-hours limits.");
            }
            return text(`${slots.length} slot(s) where everyone is free:\n\n` +
                slots.map((s, i) => `${i + 1}. ${s.start} to ${s.end}`).join('\n'));
        }
    }
});
