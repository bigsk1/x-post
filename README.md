# X Post Assistant Firefox Extension

A Firefox extension that helps automate post creation and replies on X (formerly Twitter) using ChatGPT-4.

![x-post](https://imagedelivery.net/WfhVb8dSNAAvdXUdMfBuPQ/ac3f4bda-8be5-49af-29a1-5ea02c744100/public)

## Features

- Generate new posts using AI
- Generate contextual replies to existing posts
- Easy-to-use interface
- Debug logging
- Secure API key storage
- Real-time content generation

## Installation

1. Open Firefox and go to `about:debugging`
2. Click on "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on"
4. Navigate to the extension folder and select `manifest.json`

## Setup

1. Get your OpenAI API key from https://platform.openai.com/account/api-keys
2. Click the extension icon in Firefox
3. Enter your OpenAI API key in the settings section
4. Click "Save API Key"

## Usage

### Creating a New Post

1. Click the extension icon
2. Select "New Post" mode
3. Enter your post topic or idea
4. Click "Generate Content"
5. Review the generated content
6. Click "Post to X" to publish

### Replying to Posts

1. Navigate to the post you want to reply to on X
2. Click the extension icon
3. Select "Reply" mode
4. The post content will be automatically captured
5. Click "Generate Content"
6. Review the generated reply
7. Click "Post to X" to publish your reply

## Debug Mode

The extension includes a debug log panel that shows detailed information about operations and any errors that occur.

## Troubleshooting

1. If posts aren't being published:
   - Make sure you're logged into X
   - Check the debug log for errors
   - Ensure the API key is correctly set

2. If content generation fails:
   - Verify your API key is correct
   - Check your internet connection
   - Review the debug log for specific errors

## Privacy & Security

- Your OpenAI API key is stored locally in your browser
- No data is sent to any servers except OpenAI and X
- All communications are encrypted

## Support

For issues and feature requests, please create an issue in the repository.

## License

MIT License - Feel free to modify and distribute as needed.