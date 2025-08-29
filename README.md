# <img src="images/trash-mail.png" alt="Gmail Manager" width="48" height="48" style="vertical-align: middle;"> Gmail Manager MCP

<div align="center">

![MCP Server](https://badge.mcpx.dev?type=server)
![Gmail](https://img.shields.io/badge/Gmail-EA4335?style=flat-square&logo=gmail&logoColor=white)
[![Smithery](https://smithery.ai/badge/@muammar-yacoob/gmail-manager-mcp)](https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp)
[![MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

<img src="images/meme.png" alt="Stop sending me unnecessary emails meme" width="400">

**Clean your inbox • Organize with labels • Bulk delete emails**


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

### 2. Configure Claude Desktop

Add this to your Claude Desktop config file:
- **Windows**: [`%APPDATA%\Claude\claude_desktop_config.json`](%APPDATA%/Claude/claude_desktop_config.json)
- **macOS**: [`~/Library/Application Support/Claude/claude_desktop_config.json`](~/Library/Application%20Support/Claude/claude_desktop_config.json)
- **Linux**: [`~/.config/Claude/claude_desktop_config.json`](~/.config/Claude/claude_desktop_config.json)

```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "npx",
      "args": ["-y", "@muammar-yacoob/gmail-manager-mcp@latest"],
      "env": {
        "GMAIL_OAUTH_PATH": "path/to/gcp-oauth.keys.json"
      }
    }
  }
}
```

Or use local installation:
```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "node",
      "args": ["path/to/gmail-mcp-server/dist/index.js"],
      "env": {
        "GMAIL_OAUTH_PATH": "path/to/gcp-oauth.keys.json"
      }
    }
  }
}
```

### 3. Authentication
1. **Restart Claude Desktop** completely (close and reopen)
2. **Use the `authenticate_gmail` tool** - Claude will open your browser automatically for Gmail authentication
3. **Grant permissions** in the browser and return to Claude Desktop

*Alternative: Run `npm run auth` in terminal for manual authentication*

## 🛠️ Tools

`authenticate_gmail` • `search_emails` • `read_email` • `delete_email` • `batch_delete_emails` • `list_labels` • `create_label` • `delete_label` • `apply_label` • `remove_label` • `batch_apply_labels`

## 💬 Example Commands

### 🧹 Storage Cleanup Commands
- *"Delete all emails from noreply addresses older than 6 months"*
- *"Find and delete all promotional emails from shopping sites"*
- *"Remove all LinkedIn notification emails from the past year"*
- *"Delete all automated emails from GitHub, Slack, and Jira"*
- *"Clean up all newsletter emails I haven't opened in 3 months"*
- *"Delete all 'password reset' and 'account verification' emails"*
- *"Remove all calendar invites and meeting reminders older than 30 days"*
- *"Find and delete all emails with large attachments over 10MB"*

### 📊 Smart Organization
- *"Label all emails from banks and financial institutions as 'Finance'"*
- *"Create 'Archive-2024' label and move all old work emails there"*
- *"Find all subscription confirmation emails and label them 'Subscriptions'"*
- *"Group all travel booking confirmations under 'Travel' label"*

### 🔍 Inbox Analysis  
- *"Show me my top 10 email senders by volume this year"*
- *"Find all unread emails older than 1 month"*
- *"List all emails taking up the most storage space"*

---

<div align="center">
<a href="https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp">Get on Smithery</a> • Made for Claude Desktop
</div>