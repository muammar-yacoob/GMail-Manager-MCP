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

/**
 * Per-file Drive access, for save_attachment_to_drive.
 *
 * `drive.file` grants this app rights over the files it creates and nothing
 * else: it cannot read, list or alter anything already in the user's Drive.
 * The full `drive` scope would hand over the whole account in order to upload
 * one attachment, so it is deliberately not requested.
 *
 * The trade-off is real and worth knowing about. Because the app never gains
 * rights over folders it did not create, naming an existing folder as the
 * upload parent can come back as a 404 even though the folder plainly exists.
 * DriveService handles that by falling back to My Drive rather than losing the
 * file.
 */
export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

export const SCOPES: string[] = [...GMAIL_SCOPES, ...CALENDAR_SCOPES, ...DRIVE_SCOPES];

function grantedSet(grantedScope: string | undefined | null): Set<string> {
    return new Set((grantedScope || '').split(/\s+/).filter(Boolean));
}

/**
 * True when a token was issued before Calendar was added, i.e. it can read mail
 * but every calendar call would 403. Worth detecting so we can say "re-run
 * auth" instead of surfacing a raw Google permission error.
 */
export function hasCalendarScope(grantedScope: string | undefined | null): boolean {
    if (!grantedScope) return false;
    const granted = grantedSet(grantedScope);
    return CALENDAR_SCOPES.every((s) => granted.has(s));
}

/**
 * True when the token carries Drive rights.
 *
 * Same reasoning as the calendar check: mail keeps working either way, so a
 * bare 403 out of Drive reads as a bug in the tool rather than as a token
 * issued before Drive was part of the picture.
 */
export function hasDriveScope(grantedScope: string | undefined | null): boolean {
    if (!grantedScope) return false;
    const granted = grantedSet(grantedScope);
    return DRIVE_SCOPES.every((s) => granted.has(s));
}
