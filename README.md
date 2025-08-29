[//]: # (Constants)
[license-link]: ../../blob/main/LICENSE
[stars-link]: ../../stargazers
[vid-link]: https://www.youtube.com/shorts/CCbY_ETwFss
[website-link]: https://spark-games.co.uk
[coffee-link]: https://buymeacoffee.com/spark88
[bug-link]: ../../issues
[release-link]: ../../releases
[fork-link]: ../../fork
[privacy-link]: ./PRIVACY.md
[issues-link]: ../../issues

# <img src="images/trash-mail.png" alt="Gmail Manager" width="48" height="48" style="vertical-align: middle;"> Gmail Manager MCP

<div align="center">

**🧹 Clean your inbox • 🏷️ Organize with labels • 🗑️ Bulk delete emails**


[![npm](https://img.shields.io/npm/v/@spark-apps/gmail-manager-mcp?style=flat-square&logo=npm&logoColor=white&color=red)](https://www.npmjs.com/package/@spark-apps/gmail-manager-mcp)
[![MCP Server](https://badge.mcpx.dev?type=server&color=yellow)](https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp)
[![MIT](https://img.shields.io/badge/License-MIT-purple?style=flat-square)](LICENSE)

[![GitHub Sponsors](https://img.shields.io/github/sponsors/muammar-yacoob?label=Sponsor&logo=github-sponsors&logoColor=white&color=pink)](https://github.com/sponsors/muammar-yacoob)
[![Buy Me Coffee](https://img.shields.io/badge/Buy%20Me-Coffee-green?logo=buy-me-a-coffee&logoColor=white)][coffee-link]
[![Report Bug](https://img.shields.io/badge/Report-Bug-red?logo=github&logoColor=white)][issues-link]
[![Downloads](https://img.shields.io/github/downloads/muammar-yacoob/GMail-Manager-MCP/total?logo=cloud-download&logoColor=white&color=blue)][release-link]
[![GitHub Stars](https://img.shields.io/github/stars/muammar-yacoob/GMail-Manager-MCP?style=social)][stars-link]

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

### 1. Get Gmail Credentials 🗝️
1. [Create New Project](https://console.cloud.google.com/projectcreate).
2. [Enable Gmail API](https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics).
3. Create [OAuth 2.0 Desktop credentials](https://console.cloud.google.com/auth/clients) and download as `gcp-oauth.keys.json`.
4. Navigate to [Data access](https://console.cloud.google.com/auth/scopes) and click **Add or remove scopes**.
5. In **Manually add scopes**, add both scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.settings.basic`
   Click **Add to table** then **Update** for each scope.
6. Navigate to [Test users](https://console.cloud.google.com/auth/audience) and add your Google email account as a test user. 

These scopes allow the Gmail Manager MCP to read, send, delete, and modify your emails, manage labels, and access basic Gmail settings.

```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "npx", "args": ["-y", "@spark-apps/gmail-manager-mcp@latest"],
      "env": {"GMAIL_OAUTH_PATH": "path/to/gcp-oauth.keys.json"}
    }
  }
}
```

**Or use local installation:**
```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "node", "args": ["path/to/gmail-mcp-server/dist/index.js"],
      "env": {"GMAIL_OAUTH_PATH": "path/to/gcp-oauth.keys.json"}
    }
  }
}
```

**Complete Setup:**

1. **Restart Claude Desktop** completely (close from tray area if needed)
2. **Try any Gmail command** from the examples below - Claude will automatically prompt for authentication
3. **Use the `authenticate_gmail` tool** when prompted - your browser will open for Gmail login
4. **Grant permissions** and return to Claude Desktop - you're ready to go! 🎉

*💡 Alternative: Run `npm run auth` in your terminal for manual setup*

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
☕ **Devs run on coffee** - [Buy me one?][coffee-link]  
🤝 **Contributions are welcome** - [🍴 Fork][fork-link], improve, PR!

## 💖 Sponsor

If you find Gmail Manager MCP useful, please consider sponsoring the project! Your support helps maintain and improve the tool.

---

<div align="center">

**🚀 Ready to clean your inbox?**

**Made with ❤️ for Claude Desktop** • [Privacy Policy](PRIVACY.md) • [Terms of Service](TERMS.md)

</div>