// Gmail Manager MCP - Auth Failed Page JavaScript

// Check URL for error type and customize message
window.addEventListener('load', function() {
    
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const messageElement = document.getElementById('message-text');
    
    // Customize message based on error type
    if (error === 'access_denied') {
        messageElement.textContent = "You cancelled the authentication process. Check out the 'Setup Instructions' below if you'd like to try again, or explore more cool tools!";
    } else if (error) {
        messageElement.textContent = `Authentication error: ${error}. Check the setup instructions below or explore more tools while you're here!`;
    }
    // Otherwise keep the default message
    
    // GIF management
    const gifs = ['cleaning.gif', 'cleaning2.gif', 'cleaning3.gif', 'cleaning4.gif', 'cleaning5.gif'];
    const errorGifElement = document.getElementById('error-gif');
    let currentGifIndex = -1;
    
    function loadNextGif() {
        // Always load the next GIF in sequence to ensure different image
        currentGifIndex = (currentGifIndex + 1) % gifs.length;
        const nextGif = gifs[currentGifIndex];
        
        if (errorGifElement) {
            // Add loading effect
            errorGifElement.classList.add('gif-loading');
            
            // Try relative path first
            const imagePath = `../images/cleaning-images/${nextGif}`;
            let attemptCount = 0;
            
            const tryLoadImage = (path) => {
                attemptCount++;
                errorGifElement.src = path;
                
                errorGifElement.onload = function() {
                    this.classList.remove('gif-loading');
                    this.classList.add('gif-loaded');
                };
                
                errorGifElement.onerror = function() {
                    if (attemptCount === 1) {
                        // Try absolute path
                        tryLoadImage(`/images/cleaning-images/${nextGif}`);
                    } else if (attemptCount === 2) {
                        // Try different relative path for direct file access
                        tryLoadImage(`images/cleaning-images/${nextGif}`);
                    } else {
                        // All paths failed, show fallback text and hide image
                        this.style.display = 'none';
                        const existingFallback = this.parentNode.querySelector('.fallback-text');
                        if (!existingFallback) {
                            const fallbackText = document.createElement('p');
                            fallbackText.className = 'fallback-text';
                            fallbackText.innerHTML = '🧹<br><span style="font-size: 14px; color: #94a3b8;">Cleaning animation would be here</span>';
                            fallbackText.style.cssText = 'color: #64748b; font-size: 18px; margin-top: 20px; text-align: center; line-height: 1.4;';
                            this.parentNode.appendChild(fallbackText);
                        }
                        console.log('All image paths failed for:', nextGif);
                    }
                };
            };
            
            tryLoadImage(imagePath);
        }
    }
    
    // Load initial GIF
    loadNextGif();
    
    // Click anywhere to load next GIF
    document.addEventListener('click', function(e) {
        // Don't reload GIF if clicking on buttons
        if (!e.target.classList.contains('btn') && !e.target.closest('.btn')) {
            loadNextGif();
        }
    });
    
    // Also allow clicking directly on the image
    if (errorGifElement) {
        errorGifElement.addEventListener('click', function(e) {
            e.stopPropagation();
            loadNextGif();
        });
    }
    
    // Load buttons
    loadButtons();
});

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

// Load buttons function
function loadButtons() {
    const buttonsContainer = document.getElementById('common-buttons');
    if (window.ButtonComponents) {
        // Failed page shows: Setup & Explore buttons
        buttonsContainer.innerHTML = window.ButtonComponents.createButtons(['setup', 'explore']);
    } else {
        // Fallback when buttons.js didn't load
        console.warn('ButtonComponents not available - using inline fallback');
        buttonsContainer.innerHTML = createFallbackButtons(['setup', 'explore']);
    }
}

