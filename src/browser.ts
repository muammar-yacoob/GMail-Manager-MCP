/**
 * Open the consent URL in whatever browser this machine has.
 *
 * Two copies of this existed and had drifted apart: the one behind the `auth`
 * subcommand knew nothing about WSL, so running it there printed "waiting for
 * authorization" against a browser that was never going to open.
 */

import { exec } from 'child_process';
import fs from 'fs';
import os from 'os';

function isWSL(): boolean {
    try {
        return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
    } catch {
        return false;
    }
}

/** Commands to try in order; the first that exits cleanly wins. */
function candidates(url: string): string[] {
    if (isWSL()) return [`cmd.exe /c start "" "${url}"`, `powershell.exe -Command "Start-Process '${url}'"`];

    switch (os.platform()) {
        case 'darwin': return [`open "${url}"`];
        case 'win32': return [`cmd.exe /c start "" "${url}"`];
        default: return [`xdg-open "${url}"`, `sensible-browser "${url}"`];
    }
}

/**
 * Best effort. A failure here is not fatal: the URL has already been printed,
 * and the user can open it by hand.
 */
export function openBrowser(url: string): void {
    const queue = candidates(url);

    const attempt = (index: number): void => {
        if (index >= queue.length) {
            console.error('Could not open a browser automatically. Please open the URL above manually.');
            return;
        }
        exec(queue[index], error => {
            if (error) attempt(index + 1);
        });
    };

    attempt(0);
}
