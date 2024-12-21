//content.js
if (!window.XPostAssistant) {
    window.XPostAssistant = {
        // First update the SELECTORS object
        SELECTORS: {
            composeButton: '[data-testid="SideNav_NewTweet_Button"]',
            tweetTextarea: '[data-testid="tweetTextarea_0"]',
            tweetTextInput: '[role="textbox"][data-testid="tweetTextarea_0"]',
            postButton: '[data-testid="tweetButton"]',
            originalPost: 'article[data-testid="tweet"]',
            originalPostText: '[data-testid="tweetText"]',
            replyButton: '[data-testid="reply"]',
            timeElement: 'time',
            tweetLink: 'a[href*="/status/"]'
        },

        debugLog: function(message) {
            console.log(`[X Post Assistant Content] ${message}`);
        },

        sleep: function(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        // Add the new getCurrentPostId function here
        getCurrentPostId: function() {
            try {
                // First try to get from URL
                const url = window.location.href;
                const urlMatch = url.match(/status\/(\d+)/);
                if (urlMatch) return urlMatch[1];

                // If not in URL, try to get from the tweet element
                const tweetArticle = document.querySelector(this.SELECTORS.originalPost);
                if (tweetArticle) {
                    const timeElement = tweetArticle.querySelector('time');
                    if (timeElement) {
                        const link = timeElement.closest('a');
                        if (link) {
                            const href = link.getAttribute('href');
                            const statusMatch = href.match(/status\/(\d+)/);
                            if (statusMatch) return statusMatch[1];
                        }
                    }
                }
                return null;
            } catch (error) {
                this.debugLog('Error getting post ID: ' + error.message);
                return null;
            }
        },

        // Get the original post content
        getOriginalPostContent: function() {
            try {
                const tweetArticle = document.querySelector(this.SELECTORS.originalPost);
                if (!tweetArticle) {
                    throw new Error('Could not find original post');
                }
        
                const tweetText = tweetArticle.querySelector(this.SELECTORS.originalPostText);
                if (!tweetText) {
                    throw new Error('Could not find tweet text');
                }
        
                // Enhanced image detection
                let imageData = null;
                const imageContainer = tweetArticle.querySelector('div[data-testid="tweetPhoto"]');
                if (imageContainer) {
                    const img = imageContainer.querySelector('img');
                    if (img) {
                        imageData = {
                            url: img.src,
                            alt: img.alt || ''
                        };
                        this.debugLog('Found image URL: ' + imageData.url);
                    }
                }
        
                // Get author info
                let authorName = '';
                const authorElement = tweetArticle.querySelector('a[role="link"] div[dir="ltr"] span');
                if (authorElement) {
                    authorName = authorElement.textContent;
                }
        
                return {
                    text: tweetText.textContent,
                    author: authorName,
                    id: this.getCurrentPostId(),
                    hasImage: !!imageData,
                    imageData: imageData
                };
            } catch (error) {
                this.debugLog('Error getting original post: ' + error.message);
                return null;
            }
        },

        waitForElement: function(selector, timeout = 5000) {
            this.debugLog(`Waiting for element: ${selector}`);
            return new Promise((resolve, reject) => {
                // Check if element already exists
                const element = document.querySelector(selector);
                if (element) {
                    this.debugLog(`Element ${selector} found immediately`);
                    resolve(element);
                    return;
                }

                const observer = new MutationObserver((mutations, obs) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        obs.disconnect();
                        this.debugLog(`Element ${selector} found after waiting`);
                        resolve(element);
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true
                });

                setTimeout(() => {
                    observer.disconnect();
                    this.debugLog(`Timeout waiting for element: ${selector}`);
                    reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                }, timeout);
            });
        },

        simulateTyping: function(element, text) {
            return new Promise(async (resolve, reject) => {
                try {
                    this.debugLog('Starting typing simulation');
                    
                    // Focus the element
                    element.focus();
                    await this.sleep(100);

                    // Clear existing content
                    element.innerHTML = '';
                    
                    // Create and dispatch beforeinput event
                    const beforeInputEvent = new InputEvent('beforeinput', {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'insertText',
                        data: text
                    });
                    element.dispatchEvent(beforeInputEvent);

                    // Set the content
                    element.innerHTML = text;
                    
                    // Create and dispatch input event
                    const inputEvent = new InputEvent('input', {
                        bubbles: true,
                        cancelable: true,
                        inputType: 'insertText',
                        data: text
                    });
                    element.dispatchEvent(inputEvent);

                    // Dispatch composition events
                    element.dispatchEvent(new Event('compositionstart', { bubbles: true }));
                    element.dispatchEvent(new Event('compositionend', { bubbles: true }));
                    
                    // Additional events that X might be listening for
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                    element.dispatchEvent(new Event('blur', { bubbles: true }));
                    element.dispatchEvent(new Event('focus', { bubbles: true }));
                    
                    await this.sleep(100);
                    this.debugLog('Typing simulation complete');
                    resolve();
                } catch (error) {
                    this.debugLog('Error in typing simulation: ' + error.message);
                    reject(error);
                }
            });
        },

        handlePost: function(content, replyToId) {
            return new Promise(async (resolve, reject) => {
                try {
                    this.debugLog('Starting post process');
                    
                    if (replyToId) {
                        // For replies, find and click the reply button if not already clicked
                        const replyButton = document.querySelector(this.SELECTORS.replyButton);
                        if (replyButton) {
                            replyButton.click();
                            await this.sleep(500);
                        }
                    } else {
                        // For new posts, click compose button
                        const composeButton = await this.waitForElement(this.SELECTORS.composeButton);
                        composeButton.click();
                        await this.sleep(500);
                    }
                    
                    // Find the text input
                    const textInput = await this.waitForElement(this.SELECTORS.tweetTextInput);
                    if (!textInput) {
                        throw new Error('Could not find tweet input area');
                    }
                    
                    // Input the content
                    await this.simulateTyping(textInput, content);
                    this.debugLog('Content inserted successfully');

                    // Auto post if enabled
                    await this.sleep(500);
                    const postButton = await this.waitForElement(this.SELECTORS.postButton);
                    if (postButton && !postButton.disabled) {
                        postButton.click();
                    }
                    
                    resolve({ success: true });
                } catch (error) {
                    this.debugLog('Error in handlePost: ' + error.message);
                    resolve({ success: false, error: error.message });
                }
            });
        }
    };

    // Set up message listener
    browser.runtime.onMessage.addListener((request, sender) => {
        const assistant = window.XPostAssistant;
        assistant.debugLog('Received message: ' + request.type);
        
        switch (request.type) {
            case 'postToX':
                return assistant.handlePost(request.content, request.replyToId);
            case 'getCurrentPostId':
                return Promise.resolve({ 
                    postId: assistant.getCurrentPostId(),
                    originalPost: assistant.getOriginalPostContent()
                });
            default:
                return Promise.resolve({ success: false, error: 'Unknown message type' });
        }
    });
}