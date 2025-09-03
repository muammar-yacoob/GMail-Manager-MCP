// Button Components for Gmail Manager MCP

// Configuration constants
const BUTTON_CONFIG = {
    urls: {
        support: 'https://github.com/muammar-yacoob/GMail-Manager-MCP#-support--contributions',
        explore: 'https://github.com/muammar-yacoob/GMail-Manager-MCP',
        setupInstructions: 'https://github.com/muammar-yacoob/GMail-Manager-MCP#-quick-setup'
    },
    text: {
        support: '💖 Support & Contributions',
        explore: '📦 View Repository',
        setupInstructions: '📖 Setup Instructions'
    }
};

function createButton(text, href, className = 'btn primary-btn') {
    return `<a href="${href}" class="${className}" target="_blank">${text}</a>`;
}

function createSupportButton() {
    return createButton(BUTTON_CONFIG.text.support, BUTTON_CONFIG.urls.support, 'btn support-btn');
}

function createExploreButton() {
    return createButton(BUTTON_CONFIG.text.explore, BUTTON_CONFIG.urls.explore);
}

function createSetupButton() {
    return createButton(BUTTON_CONFIG.text.setupInstructions, BUTTON_CONFIG.urls.setupInstructions);
}

function createCommonButtons() {
    return `
        <div class="button-container">
            ${createSupportButton()}
            ${createExploreButton()}
        </div>
    `;
}

function createFailedPageButtons() {
    return `
        <div class="button-container">
            ${createSetupButton()}
            ${createExploreButton()}
        </div>
    `;
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = { 
        createButton, 
        createSupportButton, 
        createExploreButton,
        createSetupButton,
        createCommonButtons,
        createFailedPageButtons,
        BUTTON_CONFIG 
    };
} else if (typeof window !== 'undefined') {
    // Browser environment - attach to window object
    window.ButtonComponents = { 
        createButton, 
        createSupportButton, 
        createExploreButton,
        createSetupButton,
        createCommonButtons,
        createFailedPageButtons,
        BUTTON_CONFIG 
    };
}