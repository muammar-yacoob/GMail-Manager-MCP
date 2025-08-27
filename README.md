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

### 2. Install via Smithery
```bash
# 📋 Copy this command
npx @smithery/cli install @muammar-yacoob/gmail-manager-mcp --client claude
```

**Smithery Configuration:**
- **GCP OAuth Keys File**: Path to your `gcp-oauth.keys.json` file (required)
- **Credentials Storage Path**: Leave empty (optional - defaults to `~/.gmail-mcp/credentials.json`)

**Alternative: Manual Claude Desktop config**
```json
// 📋 Copy this config to your Claude Desktop settings
{
  "mcpServers": {
    "gmail-manager": {
      "command": "node",
      "args": ["path/to/gmail-manager-mcp/dist/index.js"],
      "env": {
        "GMAIL_OAUTH_PATH": "path/to/gcp-oauth.keys.json"
      }
    }
  }
}
```

### 3. One-time authentication setup

**For Smithery users:**
- Enter your `gcp-oauth.keys.json` file path in Smithery configuration
- First Gmail tool use will authenticate automatically

**For manual installation:**
```bash
# 📋 Place gcp-oauth.keys.json in project directory, then copy & run:
npm run auth

# ✅ Authentication completed successfully!
# 🎉 Gmail Manager is now ready to use with Claude Desktop
```

After authentication, all Gmail tools work seamlessly without re-authentication!

## 🛠️ Tools

`search_emails` • `read_email` • `delete_email` • `batch_delete_emails` • `list_labels` • `create_label` • `delete_label` • `apply_label` • `remove_label` • `batch_apply_labels`

## 💬 Example Commands

- *"Find and label newsletter emails for review"*
- *"Show me potentially spam messages to check"*
- *"Delete all linkedIn and social media notifications"*
- *"Delete all emails from domain.com"*
- *"Delete all emails from amazon.com that are older than one year"*

## 🔧 Troubleshooting

**"Authentication required" error?**
- Run `npm run auth` for one-time setup
- For Smithery: ensure `gcp-oauth.keys.json` path is configured

**Can't find gcp-oauth.keys.json?**
- Download from [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
- Choose "Desktop Application" when creating OAuth 2.0 credentials

---

<div align="center">
<a href="https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp">Get on Smithery</a> • Made for Claude Desktop
</div>