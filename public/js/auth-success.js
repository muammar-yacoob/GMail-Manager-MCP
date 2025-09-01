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
            name: "🧹 Storage Cleanup",
            icon: "🧹",
            commands: [
                "Delete all promotional emails from the last 30 days",
                "Find and clean up all newsletter emails",
                "Remove all automated notifications older than 1 month",
                "Delete all calendar invites older than 30 days"
            ]
        },
        {
            id: "smart-organization",
            name: "📊 Smart Organization", 
            icon: "📊",
            commands: [
                "Label all financial emails as 'Finance'",
                "Create 'Archive-2024' label and move old work emails",
                "Group all travel confirmations under 'Travel'",
                "Label subscription emails as 'Subscriptions'"
            ]
        },
        {
            id: "inbox-analysis",
            name: "🔍 Inbox Analysis",
            icon: "🔍", 
            commands: [
                "Show me my largest emails taking up storage",
                "Find all unread emails older than 2 weeks",
                "List my top 10 email senders by volume",
                "Analyze email patterns and suggest cleanup"
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
            item.previousElementSibling.querySelector('.accordion-icon').style.transform = 'rotate(0deg)';
        }
    });
    
    if (isActive) {
        content.classList.remove('active');
        header.classList.remove('active');
        icon.style.transform = 'rotate(0deg)';
    } else {
        content.classList.add('active');
        header.classList.add('active');
        icon.style.transform = 'rotate(180deg)';
    }
}

function copyCommand(element) {
    const text = element.textContent.trim();
    navigator.clipboard.writeText(text).then(() => {
        showCopyNotification();
        element.style.color = '#22c55e';
        setTimeout(() => element.style.color = '', 300);
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

// Load buttons
function loadButtons() {
    const buttonsContainer = document.getElementById('common-buttons');
    buttonsContainer.innerHTML = `
        <div style="text-align: center; margin-top: 24px;">
            <a href="https://github.com/muammar-yacoob/GMail-Manager-MCP#-quick-setup" class="btn" target="_blank">📖 Setup Instructions</a>
            <a href="https://spark-games.co.uk" class="btn" target="_blank">🚀 Explore More</a>
        </div>
    `;
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