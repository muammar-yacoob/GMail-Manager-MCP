import fs from 'fs';
import path from 'path';
// Get directory path for ES modules
const currentDir = (() => {
    // In ES modules, we need to construct __dirname equivalent
    try {
        return path.dirname(new URL(import.meta.url).pathname);
    } catch {
        // Fallback for build-time or when import.meta is not available
        return path.join(process.cwd(), 'dist', 'auth-utils');
    }
})();

/**
 * Get the auth success HTML with inline CSS, JavaScript, and JSON data
 */
export function getAuthSuccessHTML(): string {
    const htmlPath = path.join(currentDir, '..', '..', 'public', 'auth-pages', 'auth-success.html');
    const cssPath = path.join(currentDir, '..', '..', 'public', 'css', 'auth-success.css');
    const jsPath = path.join(currentDir, '..', '..', 'public', 'js', 'auth-success.js');
    const commandsPath = path.join(currentDir, '..', '..', 'public', 'data', 'commands.json');
    
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // If CSS file exists, inject it inline
    if (fs.existsSync(cssPath)) {
        const css = fs.readFileSync(cssPath, 'utf8');
        html = html.replace(
            '<link rel="stylesheet" href="/css/auth-success.css">',
            `<style>\n${css}\n    </style>`
        );
    }
    
    // If JavaScript file exists, inject it inline
    if (fs.existsSync(jsPath)) {
        let js = fs.readFileSync(jsPath, 'utf8');
        
        // If commands.json exists, inject the data inline to avoid fetch issues
        if (fs.existsSync(commandsPath)) {
            const commandsData = fs.readFileSync(commandsPath, 'utf8');
            
            // Replace the fetch call with inline data
            js = js.replace(
                /const response = await fetch\('\/data\/commands\.json'\);[\s\S]*?const data = await response\.json\(\);/,
                `const data = ${commandsData};`
            );
            
            // Remove the console logs related to fetch since we're using inline data
            js = js.replace(/console\.log\('🔄 Loading commands from \/data\/commands\.json\.\.\.'\);/, '');
            js = js.replace(/console\.log\('Current URL:', window\.location\.href\);/, '');
            js = js.replace(/console\.log\('Fetch URL will be:', new URL\('\/data\/commands\.json', window\.location\.origin\)\.href\);/, '');
            js = js.replace(/console\.log\('📡 Response received:', \{[\s\S]*?\}\);/, '');
            js = js.replace(/if \(!response\.ok\) \{[\s\S]*?\}/, '');
        }
        
        html = html.replace(
            '<script src="/js/auth-success.js"></script>',
            `<script>\n${js}\n    </script>`
        );
    }
    
    return html;
}

/**
 * Get the auth failed HTML with inline CSS and JavaScript
 */
export function getAuthFailedHTML(): string {
    const htmlPath = path.join(currentDir, '..', '..', 'public', 'auth-pages', 'auth-failed.html');
    const cssPath = path.join(currentDir, '..', '..', 'public', 'css', 'auth-failed.css');
    const jsPath = path.join(currentDir, '..', '..', 'public', 'js', 'auth-failed.js');
    
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // If CSS file exists, inject it inline
    if (fs.existsSync(cssPath)) {
        const css = fs.readFileSync(cssPath, 'utf8');
        html = html.replace(
            '<link rel="stylesheet" href="/css/auth-failed.css">',
            `<style>\n${css}\n    </style>`
        );
    }
    
    // If JavaScript file exists, inject it inline
    if (fs.existsSync(jsPath)) {
        const js = fs.readFileSync(jsPath, 'utf8');
        html = html.replace(
            '<script src="/js/auth-failed.js"></script>',
            `<script>\n${js}\n    </script>`
        );
    }
    
    return html;
}

/**
 * Get the auth error HTML (fallback)
 */
export function getAuthErrorHTML(): string {
    const htmlPath = path.join(currentDir, '..', '..', 'public', 'auth-pages', 'auth-failed.html');
    return fs.readFileSync(htmlPath, 'utf8');
}

