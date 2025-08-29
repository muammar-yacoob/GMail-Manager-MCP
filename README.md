# <img src="images/trash-mail.png" alt="Gmail Manager" width="48" height="48" style="vertical-align: middle;"> Gmail Manager MCP

<div align="center">

**🧹 Clean your inbox • 🏷️ Organize with labels • 🗑️ Bulk delete emails**

![MCP Server](https://badge.mcpx.dev?type=server)
![Gmail](https://img.shields.io/badge/Gmail-EA4335?style=flat-square&logo=gmail&logoColor=white)
[![Smithery](https://smithery.ai/badge/@muammar-yacoob/gmail-manager-mcp)](https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp)
[![MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

[![GitHub Sponsors](https://img.shields.io/github/sponsors/muammar-yacoob?label=Sponsor&logo=github-sponsors&logoColor=white&color=pink)](https://github.com/sponsors/muammar-yacoob)
[![Buy Me Coffee](https://img.shields.io/badge/Buy%20Me-Coffee-green?logo=buy-me-a-coffee&logoColor=white)](https://buymeacoffee.com/spark88)
[![Report Bug](https://img.shields.io/badge/Report-Bug-red?logo=github&logoColor=white)](https://github.com/muammar-yacoob/GMail-Manager-MCP/issues)
[![Downloads](https://img.shields.io/github/downloads/muammar-yacoob/GMail-Manager-MCP/total?logo=cloud-download&logoColor=white&color=blue)](https://github.com/muammar-yacoob/GMail-Manager-MCP/releases)
[![GitHub Stars](https://img.shields.io/github/stars/muammar-yacoob/GMail-Manager-MCP?style=social)](https://github.com/muammar-yacoob/GMail-Manager-MCP/stargazers)

<img src="images/meme.png" alt="Stop sending me unnecessary emails meme" width="400">

</div>

## ✨ What It Does

Gmail Manager MCP gives Claude Desktop **direct access** to your Gmail inbox, allowing you to:

| Feature | Description |
|---------|-------------|
| ![Search](https://img.shields.io/badge/🔍-Search%20%26%20Filter-4285F4?style=for-the-badge&logo=gmail&logoColor=white) | Find emails by sender, subject, date, or any Gmail query |
| ![Organize](https://img.shields.io/badge/🏷️-Smart%20Organization-34A853?style=for-the-badge&logo=googletasks&logoColor=white) | Create and apply labels to categorize emails automatically |
| ![Bulk](https://img.shields.io/badge/🗑️-Bulk%20Operations-EA4335?style=for-the-badge&logo=googlesheets&logoColor=white) | Delete multiple emails at once based on your criteria |
| ![Analytics](https://img.shields.io/badge/📊-Inbox%20Analytics-FBBC04?style=for-the-badge&logo=googleanalytics&logoColor=white) | Get insights about your email patterns and volume |
| ![Cleanup](https://img.shields.io/badge/🧹-Smart%20Cleanup-9AA0A6?style=for-the-badge&logo=googleoptimize&logoColor=white) | Remove old newsletters, notifications, and spam efficiently |

Perfect for **inbox zero enthusiasts** and anyone drowning in email overload! 📧💀

## 🚀 Installation

### 1. Get Gmail Credentials
- Visit [Google Cloud Console](https://console.cloud.google.com/)
- Enable Gmail API → Create OAuth 2.0 Desktop credentials → Download as `gcp-oauth.keys.json`

### 2. Configure Claude Desktop

Add this to your Claude Desktop config file:
- ![Windows](https://img.shields.io/badge/Windows-0078D4?style=flat-square&logo=windows&logoColor=white) [`%APPDATA%\Claude\claude_desktop_config.json`](%APPDATA%/Claude/claude_desktop_config.json)
- ![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white) [`~/Library/Application Support/Claude/claude_desktop_config.json`](~/Library/Application%20Support/Claude/claude_desktop_config.json)
- ![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black) [`~/.config/Claude/claude_desktop_config.json`](~/.config/Claude/claude_desktop_config.json)

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

**Or use local installation:**
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

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| ![Auth](https://img.shields.io/badge/🔐-authenticate__gmail-blue?style=flat-square) | Authenticate Gmail access via web browser |
| ![Search](https://img.shields.io/badge/🔍-search__emails-green?style=flat-square) | Search emails using Gmail query syntax |
| ![Read](https://img.shields.io/badge/📖-read__email-orange?style=flat-square) | Read the full content of an email |
| ![Delete](https://img.shields.io/badge/🗑️-delete__email-red?style=flat-square) | Permanently delete an email |
| ![Batch Delete](https://img.shields.io/badge/💥-batch__delete__emails-darkred?style=flat-square) | Delete multiple emails at once |
| ![Labels](https://img.shields.io/badge/📋-list__labels-purple?style=flat-square) | List all Gmail labels |
| ![Create](https://img.shields.io/badge/➕-create__label-brightgreen?style=flat-square) | Create a new Gmail label |
| ![Remove](https://img.shields.io/badge/❌-delete__label-red?style=flat-square) | Delete a Gmail label |
| ![Apply](https://img.shields.io/badge/🏷️-apply__label-blue?style=flat-square) | Apply a label to an email |
| ![Unlabel](https://img.shields.io/badge/🚫-remove__label-orange?style=flat-square) | Remove a label from an email |
| ![Batch Apply](https://img.shields.io/badge/⚡-batch__apply__labels-yellow?style=flat-square) | Apply labels to multiple emails |

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

## 🌱 Support & Contributions

⭐ **Star the repo** & I power up like Mario 🍄  
☕ **Devs run on coffee** - [Buy me one?](https://buymeacoffee.com/spark88)  
🤝 **Contributions are welcome** - Fork, improve, PR!

## 💖 Sponsor

If you find Gmail Manager MCP useful, please consider sponsoring the project! Your support helps maintain and improve the tool.

---

<div align="center">

**🚀 Ready to clean your inbox?**

<a href="https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp">🎯 Get on Smithery</a> • **Made with ❤️ for Claude Desktop**

</div>