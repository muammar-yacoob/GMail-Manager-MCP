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
    let currentGif = '';
    
    function loadRandomGif() {
        let randomGif;
        do {
            randomGif = gifs[Math.floor(Math.random() * gifs.length)];
        } while (randomGif === currentGif && gifs.length > 1);
        
        currentGif = randomGif;
        
        if (errorGifElement) {
            // Add loading effect
            errorGifElement.style.opacity = '0.5';
            
            // Try relative path first, then fallback to absolute
            const imagePath = `../images/cleaning-images/${randomGif}`;
            errorGifElement.src = imagePath;
            
            errorGifElement.onload = function() {
                this.style.opacity = '1';
            };
            
            errorGifElement.onerror = function() { 
                // Try absolute path as fallback
                const absolutePath = `/images/cleaning-images/${randomGif}`;
                if (this.src !== absolutePath) {
                    this.src = absolutePath;
                } else {
                    // If both paths fail, hide the image and show fallback text
                    errorGifElement.style.display = 'none';
                    const existingFallback = errorGifElement.parentNode.querySelector('.fallback-text');
                    if (!existingFallback) {
                        const fallbackText = document.createElement('p');
                        fallbackText.className = 'fallback-text';
                        fallbackText.textContent = '🧹 Cleaning in progress...';
                        fallbackText.style.cssText = 'color: #94a3b8; font-size: 18px; margin-top: 20px; text-align: center;';
                        errorGifElement.parentNode.appendChild(fallbackText);
                    }
                    console.log('Failed to load image from both paths:', imagePath, 'and', absolutePath);
                }
            };
        }
    }
    
    // Load initial random GIF
    loadRandomGif();
    
    // Click anywhere to load new random GIF
    document.addEventListener('click', function(e) {
        // Don't reload GIF if clicking on buttons
        if (!e.target.classList.contains('btn') && !e.target.closest('.btn')) {
            loadRandomGif();
        }
    });
    
    // Also allow clicking directly on the image
    if (errorGifElement) {
        errorGifElement.addEventListener('click', function(e) {
            e.stopPropagation();
            loadRandomGif();
        });
    }
});

