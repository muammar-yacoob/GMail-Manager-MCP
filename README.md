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

### 3. First run
1. **Restart Claude Desktop** completely (close and reopen)
2. Claude will authenticate automatically on first use

## 🛠️ Tools

`search_emails` • `read_email` • `delete_email` • `batch_delete_emails` • `list_labels` • `create_label` • `delete_label` • `apply_label` • `remove_label` • `batch_apply_labels`

## 💬 Example Commands

- *"Find and label newsletter emails for review"*
- *"Show me potentially spam messages to check"*
- *"Delete all linkedIn and social media notifications"*
- *"Delete all emails from domain.com"*
- *"Delete all emails from amazon.com that are older than one year"*

---

<div align="center">
<a href="https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp">Get on Smithery</a> • Made for Claude Desktop
</div>