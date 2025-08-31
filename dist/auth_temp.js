import fs from 'fs';
import path from 'path';
import os from 'os';
// Auth page HTML content functions
function getAuthSuccessHTML() {
    const htmlPath = path.join(process.cwd(), 'public', 'auth-success.html');
    return fs.readFileSync(htmlPath, 'utf8');
}
function getAuthFailedHTML() {
    const htmlPath = path.join(process.cwd(), 'public', 'auth-failed.html');
    return fs.readFileSync(htmlPath, 'utf8');
}
function getAuthErrorHTML() {
    const htmlPath = path.join(process.cwd(), 'public', 'auth-error.html');
    return fs.readFileSync(htmlPath, 'utf8');
}
const CONFIG_DIR = path.join(os.homedir(), '.gmail-mcp');
function findFileInPaths(filename, possiblePaths) {
}
