// Button Components for Gmail Manager MCP

// Available buttons configuration
const BUTTONS = {
    support: {
        text: '💖 Support & Contributions',
        url: 'https://github.com/muammar-yacoob/GMail-Manager-MCP#-support--contributions',
        className: 'btn support-btn'
    },
    explore: {
        text: '🚀 Explore More',
        url: 'https://spark-games.co.uk',
        className: 'btn primary-btn'
    },
    setup: {
        text: '📖 Setup Instructions',
        url: 'https://github.com/muammar-yacoob/GMail-Manager-MCP#-quick-setup',
        className: 'btn primary-btn'
    }
};

// Create buttons from array of button keys
function createButtons(buttonKeys) {
    const buttonHtml = buttonKeys
        .map(key => {
            const button = BUTTONS[key];
            if (!button) {
                console.warn(`Button '${key}' not found in BUTTONS config`);
                return '';
            }
            return `<a href="${button.url}" class="${button.className}" target="_blank">${button.text}</a>`;
        })
        .filter(html => html !== '')
        .join('');
    
    return `<div class="button-container">${buttonHtml}</div>`;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        createButtons,
        BUTTONS 
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - attach to window object
    window.ButtonComponents = { 
        createButtons,
        BUTTONS 
    };
}