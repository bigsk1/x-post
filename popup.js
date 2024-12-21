// popup.js
let currentMode = 'newPost';
let debugMode = true;

// Utility functions
function debugLog(message) {
    if (debugMode) {
        const logContent = document.getElementById('log-content');
        if (logContent) {
            const timestamp = new Date().toLocaleTimeString();
            logContent.textContent += `[${timestamp}] ${message}\n`;
            logContent.scrollTop = logContent.scrollHeight;
        }
        console.log(`[X Post Assistant] ${message}`);
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showStatus(message, type) {
    const status = document.getElementById('status');
    if (status) {
        status.textContent = message;
        status.className = 'status ' + type;
        status.style.display = 'block';
        debugLog(message);
    }
}

function updatePlaceholder() {
    const input = document.getElementById('content-input');
    if (input) {
        input.placeholder = currentMode === 'newPost' 
            ? 'Enter your post topic...' 
            : 'Enter the post you want to reply to...';
    }
}

// Save state to storage
const saveState = debounce(function() {
    const state = {
        currentMode: currentMode,
        inputContent: document.getElementById('content-input')?.value || '',
        generatedContent: document.getElementById('generated-text')?.value || '',
        lastStatus: document.getElementById('status')?.textContent || '',
        lastStatusType: document.getElementById('status')?.className.replace('status ', '') || '',
        timestamp: new Date().getTime()
    };
    
    browser.storage.local.set({ popupState: state });
    debugLog('State saved');
}, 500); // Only save state after 500ms of no changes

function updateCharCount() {
    const textArea = document.getElementById('generated-text');
    const charCount = document.getElementById('char-count');
    
    if (textArea && charCount) {
        const count = textArea.value.length;
        charCount.textContent = count;
        charCount.style.color = count > 280 ? 'var(--error)' : 'var(--text-secondary)';
    }
}

// Load state from storage
async function loadState() {
    try {
        const { popupState } = await browser.storage.local.get('popupState');
        
        if (popupState && (new Date().getTime() - popupState.timestamp) < 300000) { // 5 minute expiry
            currentMode = popupState.currentMode;
            
            // Restore mode selection
            document.querySelectorAll('.mode-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentMode = btn.dataset.mode;
                    updatePlaceholder();
                    await updateReplyContext(); // Add this line
                    saveState();
                });
            });
            // Restore input content
            const inputEl = document.getElementById('content-input');
            if (inputEl && popupState.inputContent) {
                inputEl.value = popupState.inputContent;
            }
            
            // Restore generated content
            if (popupState.generatedContent) {
                const generatedContent = document.getElementById('generated-content');
                const generatedText = document.getElementById('generated-text');
                const postBtn = document.getElementById('post-btn');
                const clearBtn = document.getElementById('clear-state');
                
                if (generatedContent && generatedText && postBtn) {
                    generatedContent.style.display = 'block';
                    generatedText.value = popupState.generatedContent;
                    postBtn.style.display = 'block';
                    if (clearBtn) clearBtn.style.display = 'block';
                }
            }
            
            // Restore status
            if (popupState.lastStatus) {
                showStatus(popupState.lastStatus, popupState.lastStatusType);
            }
            
            debugLog('State restored');
        }
    } catch (error) {
        debugLog('Error loading state: ' + error.message);
    }
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
        // Load provider settings
        const settings = await browser.storage.local.get([
            'aiProvider', 
            'openaiApiKey', 
            'xaiApiKey',
            'openaiModel',
            'xaiModel'
        ]);

        if (settings.aiProvider) {
            document.getElementById('ai-provider').value = settings.aiProvider;
            document.getElementById('openai-settings').style.display = 
                settings.aiProvider === 'openai' ? 'block' : 'none';
            document.getElementById('xai-settings').style.display = 
                settings.aiProvider === 'xai' ? 'block' : 'none';
        }

        if (settings.openaiApiKey) {
            document.getElementById('openai-key').value = settings.openaiApiKey;
        }
        if (settings.xaiApiKey) {
            document.getElementById('xai-key').value = settings.xaiApiKey;
        }
        if (settings.openaiModel) {
            document.getElementById('openai-model').value = settings.openaiModel;
        }
        if (settings.xaiModel) {
            document.getElementById('xai-model').value = settings.xaiModel;
        }

    // Load previous state
    await loadState();

    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            
            if (currentMode === 'reply') {
                try {
                    const tabs = await browser.tabs.query({active: true, currentWindow: true});
                    if (!tabs || !tabs[0]) return;
    
                    // Inject content script if needed
                    await browser.tabs.executeScript(tabs[0].id, {
                        file: 'content.js'
                    }).catch(() => {
                        // Script might already be injected, continue
                    });
    
                    const response = await browser.tabs.sendMessage(tabs[0].id, {
                        type: 'getCurrentPostId'
                    });
    
                    debugLog('Got original post: ' + JSON.stringify(response));
    
                    if (response && response.originalPost) {
                        // Auto-fill the input with original post context
                        const contentInput = document.getElementById('content-input');
                        if (contentInput) {
                            contentInput.value = `Reply to "${response.originalPost.text}"`;
                        }
    
                        // Show original post preview
                        const originalPostDiv = document.getElementById('original-post');
                        const originalPostContent = document.getElementById('original-post-content');
                        if (originalPostDiv && originalPostContent) {
                            originalPostDiv.style.display = 'block';
                            originalPostContent.textContent = `${response.originalPost.author}: ${response.originalPost.text}`;
                        }
                    } else {
                        showStatus('Please navigate to the post you want to reply to', 'error');
                    }
                } catch (error) {
                    debugLog('Error in reply mode: ' + error.message);
                    showStatus('Error getting original post. Make sure you are on a post page.', 'error');
                }
            } else {
                // Reset for new post mode
                const originalPostDiv = document.getElementById('original-post');
                if (originalPostDiv) {
                    originalPostDiv.style.display = 'none';
                }
                const contentInput = document.getElementById('content-input');
                if (contentInput) {
                    contentInput.value = '';
                }
            }
    
            updatePlaceholder();
            saveState();
        });
    });

    // Add clear state handler
    const clearStateBtn = document.getElementById('clear-state');
    if (clearStateBtn) {
        clearStateBtn.addEventListener('click', async () => {
            await browser.storage.local.remove('popupState');
            
            const contentInput = document.getElementById('content-input');
            const generatedContent = document.getElementById('generated-content');
            const generatedText = document.getElementById('generated-text');
            const postBtn = document.getElementById('post-btn');
            const clearBtn = document.getElementById('clear-state');
            
            if (contentInput) contentInput.value = '';
            if (generatedContent) generatedContent.style.display = 'none';
            if (generatedText) generatedText.value = '';
            if (postBtn) postBtn.style.display = 'none';
            if (clearBtn) clearBtn.style.display = 'none';
            
            showStatus('Draft cleared', 'info');
        });
    }

    // Input changes
    document.getElementById('content-input')?.addEventListener('input', saveState);
    document.getElementById('generated-text')?.addEventListener('input', saveState);

    // Generate content
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateContent);
    }

    // Post to X
    const postBtn = document.getElementById('post-btn');
    if (postBtn) {
        postBtn.addEventListener('click', postToX);
    }

    // Save API key
    const saveKeyBtn = document.getElementById('save-api-key');
    if (saveKeyBtn) {
        saveKeyBtn.addEventListener('click', saveApiKey);
    }

    const generatedText = document.getElementById('generated-text');
    if (generatedText) {
        generatedText.addEventListener('input', () => {
            updateCharCount();
            saveState();
        });
    }

    // Initial character count
    updateCharCount();
});

async function generateContent() {
    const input = document.getElementById('content-input');
    if (!input || !input.value) {
        showStatus('Please enter a topic or idea for your post', 'error');
        return;
    }

    showStatus('Generating content...', 'info');

    try {
        // Check for API key first
        const settings = await browser.storage.local.get(['aiProvider', 'openaiApiKey', 'xaiApiKey']);
        const provider = settings.aiProvider || 'openai';
        const apiKey = provider === 'openai' ? settings.openaiApiKey : settings.xaiApiKey;
        if (!apiKey) {
            showStatus(`Please set your ${provider.toUpperCase()} API key first`, 'error');
            return;
        }

        // If in reply mode, get the original post content again to ensure fresh context
        let originalPost = null;
        if (currentMode === 'reply') {
            try {
                const tabs = await browser.tabs.query({active: true, currentWindow: true});
                if (tabs[0]) {
                    const response = await browser.tabs.sendMessage(tabs[0].id, {
                        type: 'getCurrentPostId'
                    });
                    originalPost = response.originalPost;
                }
            } catch (error) {
                debugLog('Error getting reply context: ' + error.message);
            }
        }

        const response = await browser.runtime.sendMessage({
            type: 'generatePost',
            mode: currentMode,
            context: input.value,
            originalPost: originalPost
        });

        debugLog('Got response from background script: ' + JSON.stringify(response));

        if (response && response.success) {
            const generatedContent = document.getElementById('generated-content');
            const generatedText = document.getElementById('generated-text');
            const postBtn = document.getElementById('post-btn');
            const clearBtn = document.getElementById('clear-state');
            
            if (generatedContent && generatedText && postBtn && clearBtn) {
                generatedContent.style.display = 'block';
                generatedText.value = response.content;
                postBtn.style.display = 'block';
                clearBtn.style.display = 'block';
                
                // Update character count
                updateCharCount();
                
                saveState();
                showStatus('Content generated! Feel free to edit before posting.', 'success');
            }
        } else {
            showStatus('Error: ' + (response?.error || 'Unknown error occurred'), 'error');
        }
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
    }
}

// Handle provider selection
document.getElementById('ai-provider').addEventListener('change', (e) => {
    const provider = e.target.value;
    document.getElementById('openai-settings').style.display = 
        provider === 'openai' ? 'block' : 'none';
    document.getElementById('xai-settings').style.display = 
        provider === 'xai' ? 'block' : 'none';
});

async function saveApiKey() {
    const provider = document.getElementById('ai-provider').value;
    const apiKey = document.getElementById(`${provider}-key`).value;
    const model = document.getElementById(`${provider}-model`).value;

    if (!apiKey || apiKey.trim() === '') {
        showStatus('Please enter an API key', 'error');
        return;
    }

    // Updated API key validation for OpenAI
    if (provider === 'openai') {
        // Check for both new and old format
        const isNewFormat = apiKey.startsWith('sk-proj-');
        const isOldFormat = apiKey.startsWith('sk-');
        
        if (!isNewFormat && !isOldFormat) {
            showStatus('Invalid OpenAI API key format. Should start with sk-proj- or sk-', 'error');
            return;
        }

        if (isNewFormat && apiKey.length < 20) {
            showStatus('Invalid OpenAI API key length', 'error');
            return;
        }
    }

    debugLog('Attempting to save settings');

    try {
        await browser.runtime.sendMessage({
            type: 'setApiKey',
            provider: provider,
            apiKey: apiKey,
            model: model
        });
        
        showStatus('Settings saved successfully!', 'success');
        debugLog('Settings updated');
    } catch (error) {
        showStatus('Error saving settings: ' + error.message, 'error');
        debugLog('Error saving settings: ' + error.message);
    }
}

async function postToX() {
    const generatedText = document.getElementById('generated-text');
    if (!generatedText || !generatedText.value) {
        showStatus('No content to post', 'error');
        return;
    }

    debugLog('Attempting to post to X');

    try {
        const tabs = await browser.tabs.query({active: true, currentWindow: true});
        
        if (!tabs || !tabs[0]) {
            throw new Error('No active tab found');
        }

        debugLog('Found active tab: ' + tabs[0].url);

        if (!tabs[0].url.includes('twitter.com') && !tabs[0].url.includes('x.com')) {
            throw new Error('Please navigate to X (Twitter) before posting');
        }

        await browser.tabs.executeScript(tabs[0].id, {
            file: 'content.js'
        });

        debugLog('Content script injected');

        const response = await browser.tabs.sendMessage(tabs[0].id, {
            type: 'postToX',
            content: generatedText.value,
            replyToId: currentMode === 'reply' ? await getCurrentPostId() : null
        });

        if (response && response.success) {
            showStatus('Posted successfully!', 'success');
        } else {
            showStatus('Error posting: ' + (response?.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
        debugLog('Error posting to X: ' + error.message);
    }
}

async function getCurrentPostId() {
    if (currentMode !== 'reply') return null;

    try {
        const tabs = await browser.tabs.query({active: true, currentWindow: true});
        if (tabs[0]) {
            const response = await browser.tabs.sendMessage(tabs[0].id, {
                type: 'getCurrentPostId'
            });
            return response?.postId || null;
        }
    } catch (error) {
        debugLog('Error getting current post ID: ' + error.message);
        return null;
    }
}