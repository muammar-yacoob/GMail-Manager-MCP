import { Readable } from 'node:stream';
// Per-API import rather than the `googleapis` barrel; see gmail-service.ts.
import { drive as driveApi } from 'googleapis/build/src/apis/drive/index.js';
import { OAuth2Client } from 'google-auth-library';

export interface UploadedFile {
    id: string;
    name: string;
    /** Browser link, so the caller can hand the user something clickable. */
    webViewLink: string;
    size: number;
    /**
     * Set when a requested parent folder could not be used and the file went to
     * My Drive instead. Callers must surface this: silently putting a case file
     * somewhere other than the case folder is worse than failing.
     */
    fellBackToRoot?: string;
}

/**
 * Google Drive, only as much of it as save_attachment_to_drive needs.
 *
 * Deliberately tiny. This server is a mail client; Drive is here so an
 * attachment can be filed without a round trip through the local disk, not so
 * the assistant can browse someone's documents. Under the `drive.file` scope it
 * could not browse them anyway.
 */
export class DriveService {
    private drive;

    constructor(auth: OAuth2Client) {
        this.drive = driveApi({ version: 'v3', auth });
    }

    /**
     * Upload a buffer and return where it landed.
     *
     * The `drive.file` scope only ever grants rights over files this app
     * created, which means a folder created in the Drive UI is invisible to us
     * even when the user can see it plainly. Naming it as a parent then fails
     * with 404 "File not found", which is a confusing way to say "not shared
     * with this app". Rather than lose an upload to that, the file goes to My
     * Drive and the result says so.
     */
    async uploadFile(
        name: string,
        mimeType: string,
        content: Buffer,
        folderId?: string
    ): Promise<UploadedFile> {
        try {
            return await this.create(name, mimeType, content, folderId);
        } catch (error: any) {
            if (!folderId || !isMissingParent(error)) throw error;

            const saved = await this.create(name, mimeType, content);
            return {
                ...saved,
                fellBackToRoot:
                    `Folder ${folderId} was not writable by this app, so the file went to My Drive instead. ` +
                    `Under the least-privilege drive.file scope this server can only see files it created ` +
                    `itself, so a folder made in the Drive web UI reads as "not found". Move the file in ` +
                    `Drive, or share that folder with the OAuth client's account.`
            };
        }
    }

    private async create(
        name: string,
        mimeType: string,
        content: Buffer,
        folderId?: string
    ): Promise<UploadedFile> {
        const { data } = await this.drive.files.create({
            requestBody: { name, ...(folderId ? { parents: [folderId] } : {}) },
            // Readable.from rather than the raw Buffer: googleapis streams the
            // body, and handing it a Buffer sends the object's inspect output
            // for anything it does not recognise as a stream.
            media: { mimeType, body: Readable.from(content) },
            fields: 'id, name, webViewLink, size'
        });

        return {
            id: data.id || '',
            name: data.name || name,
            webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
            size: Number(data.size || content.length)
        };
    }
}

/** A 404 on create means the named parent is not one this app can write to. */
function isMissingParent(error: any): boolean {
    const status = Number(error?.code ?? error?.response?.status ?? 0);
    if (status !== 404) return false;
    const reason = error?.errors?.[0]?.reason ?? '';
    return reason === 'notFound' || /not found/i.test(error?.message ?? '');
}
