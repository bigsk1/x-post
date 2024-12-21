// background.js
const API_CONFIG = {
    openai: {
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4o'
    },
    xai: {
        baseUrl: 'https://api.x.ai/v1',
        defaultModel: 'grok-2-1212'  // Using the base version number
    }
};

// Update available models
const MODELS = {
    openai: ['gpt-4o', 'gpt-4o-mini'],
    xai: [
        'grok-2-1212',           // Base model
        'grok-2-vision-1212',    // Vision model
    ]
};

// Updated system prompts for more modern X content
const SYSTEM_PROMPTS = {
    newPost: `You are a natural and engaging X user creating posts about interesting topics. Key guidelines:
    - Write conversationally, like a real person thinking and making a statement, do not ask questions!
    - No hashtags or marketing language
    - Focus on starting genuine discussions
    - Keep it concise but meaningful (max 280 chars)
    - Share insights that spark curiosity
    - Be authentic - avoid corporate or artificial tones
    - Make it engaging without being clickbaity`,
    reply: `You are crafting thoughtful, engaging replies on X. Your task is to create a relevant and meaningful response to the original post. Guidelines:
    - Read and understand the context of the original post
    - Respond naturally as if having a real conversation, make a statement and do not ask questions!
    - Address the specific points or questions raised
    - Respond to what you actually see, not what you assume
    - Add value through insights, perspective, or supportive comments
    - Keep it authentic and personal and funny when needed
    - Maximum 280 characters
    - No hashtags or marketing speak
    - Stay on topic and relevant to the original post`
};

// Debug logging
function debugLog(message) {
    console.log(`[X Post Assistant Background] ${message}`);
}

// Handle settings save
browser.runtime.onMessage.addListener((request, sender) => {
    switch (request.type) {
        case 'generatePost':
            return generateContent(request.mode, request.context, request.originalPost);
            
        case 'setApiKey':
            return browser.storage.local.set({
                aiProvider: request.provider,
                [`${request.provider}ApiKey`]: request.apiKey,
                [`${request.provider}Model`]: request.model
            }).then(() => ({ success: true }));
            
        default:
            return Promise.resolve({ success: false, error: 'Unknown message type' });
    }
});

async function saveApiKey(apiKey) {
    try {
        await browser.storage.local.set({ openaiApiKey: apiKey });
        debugLog('API key saved successfully');
        return { success: true };
    } catch (error) {
        debugLog('Error saving API key: ' + error.message);
        return { success: false, error: error.message };
    }
}

// For the vision model, we need to handle image data properly
async function generateContent(mode, context, originalPost) {
    try {
        const settings = await browser.storage.local.get([
            'aiProvider', 
            'openaiApiKey', 
            'xaiApiKey',
            'openaiModel',
            'xaiModel'
        ]);

        const provider = settings.aiProvider || 'openai';
        const config = API_CONFIG[provider];
        const apiKey = provider === 'openai' ? settings.openaiApiKey : settings.xaiApiKey;
        const model = provider === 'openai' 
            ? (settings.openaiModel || config.defaultModel)
            : (settings.xaiModel || config.defaultModel);

        debugLog(`Using provider: ${provider}`);
        debugLog(`Using model: ${model}`);

        // Build messages array based on provider and content
        let messages = [];
        
        if (provider === 'xai' && model === 'grok-2-vision-1212' && originalPost?.imageData) {
            // Vision model with image
            messages = [{
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: originalPost.imageData.url,
                            detail: 'high'
                        }
                    },
                    {
                        type: 'text',
                        text: `Please analyze this image and the following text: "${originalPost.text}". 
                              Create a relevant and engaging reply that acknowledges both the visual content 
                              and the text context.`
                    }
                ]
            }];
        } else {
            // Regular text-based request
            messages = [
                { 
                    role: 'system', 
                    content: SYSTEM_PROMPTS[mode] 
                },
                { 
                    role: 'user', 
                    content: mode === 'newPost' 
                        ? `Create a new engaging post about: ${context}`
                        : `Original post: "${originalPost?.text || context}". 
                           Write a thoughtful reply that engages with this content.`
                }
            ];
        }

        const requestBody = {
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 150,
            stream: false
        };

        debugLog('Request body: ' + JSON.stringify(requestBody));

        const response = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            debugLog('API Error response: ' + JSON.stringify(errorData));
            throw new Error(
                errorData.error?.message || 
                errorData.message || 
                `${provider.toUpperCase()} API request failed (${response.status})`
            );
        }

        const data = await response.json();
        debugLog('API Success response: ' + JSON.stringify(data));

        return { success: true, content: data.choices[0].message.content };
    } catch (error) {
        console.error('Error generating content:', error);
        debugLog('Detailed error: ' + error.stack);
        return { success: false, error: error.message };
    }
}

async function postToX(content, replyToId) {
    try {
        const tabs = await browser.tabs.query({active: true, currentWindow: true});
        if (!tabs[0]) {
            throw new Error('No active tab found');
        }
        
        const response = await browser.tabs.sendMessage(tabs[0].id, {
            type: 'postToX',
            content: content,
            replyToId: replyToId
        });
        
        return response || { success: true };
    } catch (error) {
        return { 
            success: false, 
            error: error.message 
        };
    }
}