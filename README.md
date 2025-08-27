# <img src="images/trash-mail.png" alt="Gmail Manager" width="48" height="48" style="vertical-align: middle;"> Gmail Manager MCP

<div align="center">

[![MCP Server](https://badge.mcpx.dev?type=server)](https://modelcontextprotocol.io)
[![Gmail](https://img.shields.io/badge/Gmail-EA4335?style=flat-square&logo=gmail&logoColor=white)](https://developers.google.com/gmail/api)
[![Smithery](https://smithery.ai/badge/@muammar-yacoob/gmail-manager-mcp)](https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp)
[![MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Clean your inbox • Organize with labels • Bulk delete emails**

<img src="images/meme.png" alt="Stop sending me unnecessary emails meme" width="400">

</div>

## 🎯 What It Does

Gmail Manager MCP gives Claude Desktop direct access to your Gmail inbox, allowing you to:
- **🔍 Search & Filter** - Find emails by sender, subject, date, or any Gmail query
- **🏷️ Smart Organization** - Create and apply labels to categorize emails automatically  
- **🗑️ Bulk Operations** - Delete multiple emails at once based on your criteria
- **📊 Inbox Analytics** - Get insights about your email patterns and volume
- **🧹 Smart Cleanup** - Remove old newsletters, notifications, and spam efficiently

Perfect for inbox zero enthusiasts and anyone drowning in email overload!

## ⚡ Quick Setup

### 1. Get Gmail credentials
- Visit [Google Cloud Console](https://console.cloud.google.com/)
- Enable Gmail API → Create OAuth 2.0 Desktop credentials → Download as `gcp-oauth.keys.json`

### 2. Installation Options

**Option A: Smithery Web Interface**
1. Go to [smithery.ai/server/@muammar-yacoob/gmail-manager-mcp](https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp)
2. Click "Install" → **GCP OAuth Keys File**: `/full/path/to/gcp-oauth.keys.json`
3. **Credentials Storage Path**: Leave empty → "Install to Claude Desktop"

**Option B: NPM Package** *(after publishing)*
```json
// 📋 Add this to Claude Desktop settings once published to npm
{
  "mcpServers": {
    "gmail-manager": {
      "command": "npx",
      "args": ["gmail-manager-mcp"],
      "env": {
        "GMAIL_OAUTH_PATH": "/full/path/to/gcp-oauth.keys.json"
      }
    }
  }
}
```

**Option C: Direct Git Install** *(current working method)*
```json
// 📋 Add this to Claude Desktop settings (installs latest from GitHub)
{
  "mcpServers": {
    "gmail-manager": {
      "command": "npx",
      "args": ["github:muammar-yacoob/Gmail-MCP-Server"],
      "env": {
        "GMAIL_OAUTH_PATH": "/full/path/to/gcp-oauth.keys.json"
      }
    }
  }
}
```

### 3. Authentication Flow

**🔑 How Authentication Works:**
1. **You provide OAuth keys**: Download `gcp-oauth.keys.json` from Google Cloud Console
2. **First Gmail command**: When you ask Claude to check emails, authentication starts automatically
3. **Google login screen**: Opens in your browser - sign in with your Gmail account
4. **Grant permissions**: Allow Gmail access (read/modify emails, labels)
5. **Done!** Credentials saved automatically - no need to re-authenticate

**📁 File Path Examples:**
```bash
# 📋 Windows: C:\Users\YourName\Downloads\gcp-oauth.keys.json
# 📋 macOS: /Users/YourName/Downloads/gcp-oauth.keys.json  
# 📋 Linux: /home/username/gcp-oauth.keys.json
```

**⚡ Manual pre-authentication** *(optional)*:
```bash
# 📋 If you cloned the repo locally: npm run auth
```

## 🛠️ Tools

`search_emails` • `read_email` • `delete_email` • `batch_delete_emails` • `list_labels` • `create_label` • `delete_label` • `apply_label` • `remove_label` • `batch_apply_labels`

## 💬 Example Commands

- *"Find and label newsletter emails for review"*
- *"Show me potentially spam messages to check"*
- *"Delete all linkedIn and social media notifications"*
- *"Delete all emails from domain.com"*
- *"Delete all emails from amazon.com that are older than one year"*

## 🔧 Troubleshooting

**Installation issues?**
- **Smithery not working?** Use Option C (Direct Git Install) for latest fixes
- **"Expected boolean, received null" error?** Package needs npm publishing - use Git install
- **Package not found?** Try `npx github:muammar-yacoob/Gmail-MCP-Server` directly

**"Authentication required" error?**
- Verify your `gcp-oauth.keys.json` file path is correct
- Full path required (e.g., `/Users/name/Downloads/gcp-oauth.keys.json`)
- Try asking Claude to "check my Gmail" - authentication starts automatically

**Can't find gcp-oauth.keys.json?**
- Download from [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
- Choose "Desktop Application" when creating OAuth 2.0 credentials
- Save file & remember the full path for Smithery configuration

---

<div align="center">
<a href="https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp">Get on Smithery</a> • Made for Claude Desktop
</div>