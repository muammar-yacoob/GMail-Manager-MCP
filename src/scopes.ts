/**
 * Every OAuth scope this server asks for, in one place.
 *
 * These used to be written out separately in three spots in auth.ts (the
 * consent URL, and two refresh paths). A scope added in one place but not the
 * others produces a token that passes the consent screen and then fails at
 * call time, which is a miserable thing to debug. One list, imported everywhere.
 *
 * NOTE: widening this list invalidates existing credentials. Google will not
 * retroactively grant new scopes to an already-issued refresh token, so the
 * user has to re-run `auth` after any change here.
 */

/** Full mailbox access: read, send, modify, permanently delete. */
export const GMAIL_SCOPES = ['https://mail.google.com/'];

/**
 * Read/write calendars and events, plus free/busy lookups for suggest_time.
 * The broad `calendar` scope covers calendar list, events and freebusy; the
 * narrower per-resource scopes would need three entries to do the same job.
 */
export const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar'];

export const SCOPES: string[] = [...GMAIL_SCOPES, ...CALENDAR_SCOPES];

/**
 * True when a token was issued before Calendar was added, i.e. it can read mail
 * but every calendar call would 403. Worth detecting so we can say "re-run
 * auth" instead of surfacing a raw Google permission error.
 */
export function hasCalendarScope(grantedScope: string | undefined | null): boolean {
    if (!grantedScope) return false;
    const granted = new Set(grantedScope.split(/\s+/).filter(Boolean));
    return CALENDAR_SCOPES.every((s) => granted.has(s));
}
