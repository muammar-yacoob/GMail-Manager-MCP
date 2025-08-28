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

### 2. Install via Smithery
```bash
npx @smithery/cli install @muammar-yacoob/gmail-manager-mcp --client claude --config '{"gcpOauthKeysPath": "path/to/gcp-oauth.keys.json", "credentialsPath": "~/.gmail-mcp/credentials.json"}'
```

**Important**: After installation:
1. **Manually restart Claude Desktop** (the auto-restart may not work on Windows/WSL)
2. **Verify the config was added** to `C:\Users\[username]\AppData\Roaming\Claude\claude_desktop_config.json`

**Alternative: Manual Claude Desktop config**
If the Smithery installation doesn't update your config, manually add this to your Claude Desktop config file:
```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "npx",
      "args": ["-y", "@smithery/cli", "connect", "@muammar-yacoob/gmail-manager-mcp"]
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