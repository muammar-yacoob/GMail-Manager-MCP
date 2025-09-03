// Debug: Check if we can load the external JS file
console.log('🚀 auth-success.js loaded successfully!');

// Load commands from JSON file
async function loadCommands() {
    try {
        console.log('🔄 Loading commands from /data/commands.json...');
        console.log('Current URL:', window.location.href);
        console.log('Fetch URL will be:', new URL('/data/commands.json', window.location.origin).href);
        
        const response = await fetch('/data/commands.json');
        console.log('📡 Response received:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: Object.fromEntries(response.headers.entries())
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Commands loaded successfully:', data);
        console.log('📊 Categories found:', data.categories?.length || 0);
        
        if (data.categories && data.categories.length > 0) {
            renderCommands(data.categories);
            console.log('🎯 Commands rendered successfully!');
        } else {
            throw new Error('No categories found in JSON data');
        }
    } catch (error) {
        console.error('❌ Failed to load commands:', error);
        console.log('🔄 Falling back to hardcoded commands...');
        renderFallbackCommands();
    }
}

function renderCommands(categories) {
    const accordion = document.getElementById('commands-accordion');
    accordion.innerHTML = categories.map(category => `
        <div class="accordion-item">
            <button class="accordion-header" onclick="toggleAccordion(this)">
                <span>${category.icon} ${category.name}</span>
                <span class="accordion-icon">▼</span>
            </button>
            <div class="accordion-content">
                <div class="accordion-body">
                    <ul class="command-list">
                        ${category.commands.slice(0, 4).map(command => 
                            `<li class="command-item" onclick="copyCommand(this)">${command}</li>`
                        ).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `).join('');
}

function renderFallbackCommands() {
    console.log('Rendering fallback commands with all categories...');
    const fallbackData = [
        {
            id: "storage-cleanup",
            name: "Smart Storage Cleanup",
            icon: "🧹",
            commands: [
                "Find and delete duplicate attachments across all emails",
                "Remove emails with dead/broken links older than 6 months",
                "Delete redundant email chains where I'm CC'd and the conversation continued without me",
                "Clean up emails from defunct/expired domains"
            ]
        },
        {
            id: "smart-organization",
            name: "Intelligent Organization", 
            icon: "🧠",
            commands: [
                "Auto-categorize emails by project context using content analysis",
                "Group related emails across different senders by topic/project",
                "Create smart folders based on my interaction patterns",
                "Identify and group conversation threads split across multiple subjects"
            ]
        },
        {
            id: "inbox-analysis",
            name: "Advanced Analytics",
            icon: "📊", 
            commands: [
                "Analyze my email response patterns and suggest optimization strategies",
                "Identify communication bottlenecks in project-related email threads",
                "Show email interaction network map with key stakeholders",
                "Generate engagement reports for sent newsletters"
            ]
        },
        {
            id: "automation",
            name: "Smart Automation",
            icon: "⚡",
            commands: [
                "Auto-summarize long email threads with key decisions and action items",
                "Extract and compile all action items from emails into a task list",
                "Generate meeting briefs from related email threads",
                "Auto-detect and extract recurring reports from emails"
            ]
        }
    ];
    
    const accordion = document.getElementById('commands-accordion');
    accordion.innerHTML = fallbackData.map(category => `
        <div class="accordion-item">
            <button class="accordion-header" onclick="toggleAccordion(this)">
                <span>${category.icon} ${category.name}</span>
                <span class="accordion-icon">▼</span>
            </button>
            <div class="accordion-content">
                <div class="accordion-body">
                    <ul class="command-list">
                        ${category.commands.map(command => 
                            `<li class="command-item" onclick="copyCommand(this)">${command}</li>`
                        ).join('')}
                    </ul>
                </div>
            </div>
        </div>
    `).join('');
}

function toggleAccordion(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.accordion-icon');
    const isActive = content.classList.contains('active');
    
    document.querySelectorAll('.accordion-content').forEach(item => {
        if (item !== content) {
            item.classList.remove('active');
            item.previousElementSibling.classList.remove('active');
            item.previousElementSibling.querySelector('.accordion-icon').classList.remove('rotated');
        }
    });
    
    if (isActive) {
        content.classList.remove('active');
        header.classList.remove('active');
        icon.classList.remove('rotated');
    } else {
        content.classList.add('active');
        header.classList.add('active');
        icon.classList.add('rotated');
    }
}

function copyCommand(element) {
    const text = element.textContent.trim();
    navigator.clipboard.writeText(text).then(() => {
        showCopyNotification();
        element.classList.add('copied');
        setTimeout(() => element.classList.remove('copied'), 300);
    }).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showCopyNotification();
    });
}

function showCopyNotification() {
    const notification = document.getElementById('copyNotification');
    if (notification) {
        notification.classList.add('show');
        setTimeout(() => notification.classList.remove('show'), 1000);
    }
}

// Inline fallback button config (mirrors buttons.js)
const FALLBACK_BUTTONS = {
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

function createFallbackButtons(buttonKeys) {
    const buttonHtml = buttonKeys
        .map(key => {
            const button = FALLBACK_BUTTONS[key];
            if (!button) return '';
            return `<a href="${button.url}" class="${button.className}" target="_blank">${button.text}</a>`;
        })
        .filter(html => html !== '')
        .join('');
    
    return `<div class="button-container">${buttonHtml}</div>`;
}

// Load buttons
function loadButtons() {
    const buttonsContainer = document.getElementById('common-buttons');
    if (window.ButtonComponents) {
        // Success page shows: Support & Explore buttons
        buttonsContainer.innerHTML = window.ButtonComponents.createButtons(['support', 'explore']);
    } else {
        // Fallback when buttons.js didn't load
        console.warn('ButtonComponents not available - using inline fallback');
        buttonsContainer.innerHTML = createFallbackButtons(['support', 'explore']);
    }
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 DOM loaded, initializing page...');
    loadButtons();
    loadCommands();
});

// Fallback initialization if DOMContentLoaded already fired
if (document.readyState === 'loading') {
    // DOM is still loading, event listener will handle it
} else {
    // DOM is already loaded
    console.log('🎯 DOM already loaded, initializing immediately...');
    loadButtons();
    loadCommands();
}