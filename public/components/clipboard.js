// Clipboard Components for Gmail Manager MCP
function createCopyNotification() {
    return `<div id="copyNotification" class="copy-notification">Command copied to clipboard!</div>`;
}

function addCopyNotificationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .copy-notification {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #22c55e;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            z-index: 1000;
            box-shadow: 0 2px 12px rgba(34, 197, 94, 0.4);
            pointer-events: none;
            opacity: 0;
            transition: all 0.2s ease-in-out;
            white-space: nowrap;
        }
        
        .copy-notification.show {
            opacity: 1;
        }
        
        .copy-notification::before {
            content: "✓";
            margin-right: 8px;
        }
    `;
    document.head.appendChild(style);
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showCopyNotification();
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showCopyNotification();
    } catch (err) {
        console.error('Failed to copy text: ', err);
    }
    
    document.body.removeChild(textArea);
}

function showCopyNotification() {
    const notification = document.getElementById('copyNotification');
    if (notification) {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
        }, 2000);
    }
}

export { createCopyNotification, addCopyNotificationStyles, copyToClipboard, showCopyNotification };
