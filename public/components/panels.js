// Panel Components for Gmail Manager MCP
const panelStyles = {
    container: `
        background: rgba(15, 15, 15, 0.95);
        border-radius: 16px;
        border: 1px solid rgba(34, 197, 94, 0.3);
        box-shadow: 
            0 0 40px rgba(34, 197, 94, 0.15),
            0 20px 40px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        padding: 32px;
        text-align: center;
        max-width: 700px;
        width: 100%;
        animation: slideUp 0.6s ease-out;
        backdrop-filter: blur(10px);
    `,
    error: `
        background: rgba(15, 15, 15, 0.95);
        border-radius: 16px;
        border: 1px solid rgba(239, 68, 68, 0.3);
        box-shadow: 
            0 0 40px rgba(239, 68, 68, 0.15),
            0 20px 40px rgba(0, 0, 0, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
        padding: 32px;
        text-align: center;
        max-width: 500px;
        width: 90%;
        animation: slideUp 0.6s ease-out, glowPulse 3s ease-in-out infinite;
        backdrop-filter: blur(10px);
    `
};

function createPanel(content, type = 'container', additionalClasses = '') {
    const baseStyle = type === 'error' ? panelStyles.error : panelStyles.container;
    return `<div class="panel ${type}-panel ${additionalClasses}" style="${baseStyle}">${content}</div>`;
}

function addPanelStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .panel {
            margin: 20px;
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes glowPulse {
            0%, 100% {
                box-shadow: 
                    0 0 40px rgba(239, 68, 68, 0.15),
                    0 20px 40px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
            }
            50% {
                box-shadow: 
                    0 0 60px rgba(239, 68, 68, 0.3),
                    0 20px 40px rgba(0, 0, 0, 0.5),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
            }
        }
    `;
    document.head.appendChild(style);
}

export { createPanel, addPanelStyles };
