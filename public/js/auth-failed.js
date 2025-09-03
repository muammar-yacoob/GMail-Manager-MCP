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
            
            // Try relative path first, then fallback to absolute
            const imagePath = `../images/cleaning-images/${nextGif}`;
            errorGifElement.src = imagePath;
            
            errorGifElement.onload = function() {
                this.classList.remove('gif-loading');
                this.classList.add('gif-loaded');
            };
            
            errorGifElement.onerror = function() { 
                // Try absolute path as fallback
                const absolutePath = `/images/cleaning-images/${nextGif}`;
                if (this.src.includes(absolutePath)) {
                    // If both paths fail, hide the image and show fallback text
                    errorGifElement.classList.add('gif-hidden');
                    const existingFallback = errorGifElement.parentNode.querySelector('.fallback-text');
                    if (!existingFallback) {
                        const fallbackText = document.createElement('p');
                        fallbackText.className = 'fallback-text';
                        fallbackText.textContent = '🧹 Cleaning in progress...';
                        errorGifElement.parentNode.appendChild(fallbackText);
                    }
                    console.log('Failed to load image from both paths:', imagePath, 'and', absolutePath);
                } else {
                    this.src = absolutePath;
                }
            };
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

// Load buttons function
function loadButtons() {
    const buttonsContainer = document.getElementById('common-buttons');
    if (window.ButtonComponents) {
        // Use the centralized button component for failed page
        buttonsContainer.innerHTML = window.ButtonComponents.createFailedPageButtons();
    } else {
        // Fallback if buttons.js didn't load - but this should rarely happen
        console.warn('ButtonComponents not available, using minimal fallback');
        buttonsContainer.innerHTML = `
            <div class="button-container">
                <a href="#" class="btn primary-btn" target="_blank">📖 Setup Instructions</a>
                <a href="#" class="btn primary-btn" target="_blank">🚀 Explore More</a>
            </div>
        `;
    }
}

