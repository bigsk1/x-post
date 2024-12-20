// background.js
const OPENAI_API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Updated system prompts for more modern X content
const SYSTEM_PROMPTS = {
    newPost: `You are a natural and engaging X user creating posts about interesting topics. Key guidelines:
    - Write conversationally, like a real person sharing thoughts
    - No hashtags or marketing language
    - Focus on starting genuine discussions
    - Keep it concise but meaningful (max 280 chars)
    - Share insights that spark curiosity
    - Be authentic - avoid corporate or artificial tones
    - Make it engaging without being clickbaity`,
    reply: `You are crafting thoughtful, engaging replies on X. Your task is to create a relevant and meaningful response to the original post. Guidelines:
    - Read and understand the context of the original post
    - Respond naturally as if having a real conversation
    - Address the specific points or questions raised
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

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener((request, sender) => {
    console.log('Received message:', request.type);
    
    switch (request.type) {
        case 'generatePost':
            return generateContent(request.mode, request.context, request.originalPost);
            
        case 'postToX':
            return postToX(request.content, request.replyToId);
            
        case 'setApiKey':
            return browser.storage.local.set({ openaiApiKey: request.apiKey })
                .then(() => ({ success: true }));
            
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

async function generateContent(mode, context, originalPost) {
    try {
        const { openaiApiKey } = await browser.storage.local.get('openaiApiKey');
        if (!openaiApiKey) throw new Error('OpenAI API key not set');

        // Construct the prompt based on mode
        const userPrompt = mode === 'newPost' 
            ? `Create a new engaging post about: ${context}`
            : `Original post: "${originalPost?.text || context}"
               Write a thoughtful reply that engages with this post's content.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPTS[mode] },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 150,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI API request failed');
        }

        const data = await response.json();
        return { success: true, content: data.choices[0].message.content };
    } catch (error) {
        console.error('Error generating content:', error);
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