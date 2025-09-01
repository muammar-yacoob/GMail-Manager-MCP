// Button Components for Gmail Manager MCP
const buttonStyles = {
    primary: `
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        border: none;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        margin: 8px;
        text-decoration: none;
        display: inline-block;
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    `,
    hover: `
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    `,
    active: `
        transform: translateY(0);
    `
};

function createButton(text, href, className = 'btn primary-btn') {
    return `<a href="${href}" class="${className}">${text}</a>`;
}

function createCommonButtons() {
    return `
        <div style="text-align: center; margin-top: 24px;">
            ${createButton('📖 Setup Instructions', 'https://github.com/muammar-yacoob/GMail-Manager-MCP#-quick-setup')}
            ${createButton('🚀 Explore More', 'https://spark-games.co.uk')}
        </div>
    `;
}

function addButtonStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .primary-btn {
            ${buttonStyles.primary}
        }
        
        .primary-btn:hover {
            ${buttonStyles.hover}
        }
        
        .primary-btn:active {
            ${buttonStyles.active}
        }
    `;
    document.head.appendChild(style);
}

export { createButton, createCommonButtons, addButtonStyles };
