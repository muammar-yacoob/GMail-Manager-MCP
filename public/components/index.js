// Main Components Index for Gmail Manager MCP
import { createButton, createCommonButtons, addButtonStyles } from './buttons.js';
import { createPanel, addPanelStyles } from './panels.js';
import { createCopyNotification, addCopyNotificationStyles, copyToClipboard, showCopyNotification } from './clipboard.js';

// Initialize all component styles
function initializeAllComponents() {
    addButtonStyles();
    addPanelStyles();
    addCopyNotificationStyles();
}

// Export all components
export {
    // Button components
    createButton,
    createCommonButtons,
    
    // Panel components
    createPanel,
    
    // Clipboard components
    createCopyNotification,
    copyToClipboard,
    showCopyNotification,
    
    // Initialization
    initializeAllComponents
};

// Make components available globally for backward compatibility
window.CommonComponents = {
    createCommonButtons,
    copyToClipboard,
    showCopyNotification,
    initializeCommonComponents: initializeAllComponents
};
