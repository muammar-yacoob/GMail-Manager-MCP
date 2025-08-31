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


[![npm](https://img.shields.io/npm/v/@spark-apps/gmail-manager-mcp?style=flat-square&logo=npm&logoColor=white&color=crimson)](https://www.npmjs.com/package/@spark-apps/gmail-manager-mcp)
[![MCP Server](https://badge.mcpx.dev?type=server&color=gold)](https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp)
[![MIT](https://img.shields.io/badge/License-MIT-blueviolet?style=flat-square)](LICENSE)

[![GitHub Sponsors](https://img.shields.io/github/sponsors/muammar-yacoob?label=Sponsor&logo=github-sponsors&logoColor=white&color=hotpink)](https://github.com/sponsors/muammar-yacoob)
[![Buy Me Coffee](https://img.shields.io/badge/Buy%20Me-Coffee-limegreen?logo=buy-me-a-coffee&logoColor=white)][coffee-link]
[![Report Bug](https://img.shields.io/badge/Report-Bug-orangered?logo=github&logoColor=white)][issues-link]
[![Downloads](https://img.shields.io/github/downloads/muammar-yacoob/GMail-Manager-MCP/total?logo=cloud-download&logoColor=white&color=dodgerblue)][release-link]
[![GitHub Stars](https://img.shields.io/github/stars/muammar-yacoob/GMail-Manager-MCP?style=social)][stars-link]

<img src="images/meme.png" alt="Stop sending me unnecessary emails meme" width="400">

</div>

## ✨ What It Does

Gmail Manager MCP gives Claude Desktop **direct access** to your Gmail inbox, allowing you to:

| Feature | Description |
|---------|-------------|
| ![Search](https://img.shields.io/badge/🔍-Email%20Search-blue?style=flat-square) | Find emails by sender, subject, date, or any Gmail query |
| ![Read](https://img.shields.io/badge/📖-Read%20Emails-green?style=flat-square) | Read the full content of an email |
| ![Organize](https://img.shields.io/badge/🏷️-Smart%20Organization-yellow?style=flat-square) | Create and apply labels to categorize emails automatically |
| ![Analytics](https://img.shields.io/badge/📊-Inbox%20Analytics-orange?style=flat-square) | Get insights about your email patterns and volume |
| ![Cleanup](https://img.shields.io/badge/🗑️-Bulk%20Cleanup-red?style=flat-square) | Remove old newsletters, notifications, and spam efficiently |

Perfect for **inbox zero enthusiasts** and anyone drowning in email overload! 📧💀

## 🚀 Installation

<details>
<summary><strong>📋 Step 1: Get Gmail Credentials 🗝️</strong></summary>

1. [Create New Project](https://console.cloud.google.com/projectcreate).
2. [Enable Gmail API](https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics).
3. Create [OAuth client ID](https://console.cloud.google.com/auth/clients) of the type Desktop app. Download as `gcp-oauth.keys.json`.
4. Navigate to [Data access](https://console.cloud.google.com/auth/scopes) and click **Add or remove scopes** and enter: `https://mail.google.com/` then click **Add to table** then **Update**.
6. Navigate to [Test users](https://console.cloud.google.com/auth/audience) and add your Google email account as a test user. 

These scopes allow the Gmail Manager MCP to read, send, delete, and modify your emails, manage labels, and access basic Gmail settings.

</details>

<details>
<summary><strong>⚙️ Step 2: Claude Desktop Configuration</strong></summary>

Add the configuration to your Claude Desktop config file:
- ![Windows](https://img.shields.io/badge/Windows-dodgerblue?style=flat-square&logo=windows&logoColor=white) [`%APPDATA%\Claude\claude_desktop_config.json`](%APPDATA%/Claude/claude_desktop_config.json)
- ![macOS](https://img.shields.io/badge/macOS-silver?style=flat-square&logo=apple&logoColor=black) [`~/Library/Application Support/Claude/claude_desktop_config.json`](~/Library/Application%20Support/Claude/claude_desktop_config.json)
- ![Linux](https://img.shields.io/badge/Linux-gold?style=flat-square&logo=linux&logoColor=black) [`~/.config/Claude/claude_desktop_config.json`](~/.config/Claude/claude_desktop_config.json)

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

**Example with absolute paths:**
```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "node", "args": ["D:/MCPs/Gmail-MCP-Server/dist/index.js"],
      "env": {"GMAIL_OAUTH_PATH": "D:/MCPs/Gmail-MCP-Server/gcp-oauth.keys.json"}
    }
  }
}
```

</details>

<details>
<summary><strong>🎯 Step 3: Complete Setup</strong></summary>

1. **Restart Claude Desktop** completely (close from tray area if needed)
2. **Try any Gmail command** from the examples below - Claude will automatically prompt for authentication
3. **Use the `authenticate_gmail` tool** when prompted - your browser will open for Gmail login
4. **Grant permissions** and return to Claude Desktop - you're ready to go! 🎉

*💡 Alternative: Run `npm run auth` in your terminal for manual setup*

</details>

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| ![Auth](https://img.shields.io/badge/🔐-authenticate__gmail-blue?style=flat-square) | Authenticate Gmail access via web browser |
| ![Search](https://img.shields.io/badge/🔍-search__emails-blue?style=flat-square) | Search emails using Gmail query syntax |
| ![Read](https://img.shields.io/badge/📖-read__email-green?style=flat-square) | Read the full content of an email |
| ![Labels](https://img.shields.io/badge/📋-list__labels-green?style=flat-square) | List all Gmail labels |
| ![Create](https://img.shields.io/badge/➕-create__label-yellow?style=flat-square) | Create a new Gmail label |
| ![Apply](https://img.shields.io/badge/🏷️-apply__label-yellow?style=flat-square) | Apply a label to an email |
| ![Batch Apply](https://img.shields.io/badge/⚡-batch__apply__labels-yellow?style=flat-square) | Apply labels to multiple emails |
| ![Unlabel](https://img.shields.io/badge/🚫-remove__label-yellow?style=flat-square) | Remove a label from an email |
| ![Remove](https://img.shields.io/badge/❌-delete__label-crimson?style=flat-square) | Delete a Gmail label |
| ![Delete](https://img.shields.io/badge/🗑️-delete__email-crimson?style=flat-square) | Permanently delete an email |
| ![Batch Delete](https://img.shields.io/badge/💥-batch__delete__emails-crimson?style=flat-square) | Delete multiple emails at once |

## 💬 Example Commands

<details>
<summary><strong>🧹 Storage Cleanup Commands</strong></summary>

- *"Delete all emails from noreply addresses older than 6 months"*
- *"Find and delete all promotional emails from shopping sites"*
- *"Remove all LinkedIn notification emails from the past year"*
- *"Delete all automated emails from GitHub, Slack, and Jira"*
- *"Clean up all newsletter emails I haven't opened in 3 months"*
- *"Delete all 'password reset' and 'account verification' emails"*
- *"Remove all calendar invites and meeting reminders older than 30 days"*
- *"Find and delete all emails with large attachments over 10MB"*

</details>

<details>
<summary><strong>📊 Smart Organization</strong></summary>

- *"Label all emails from banks and financial institutions as 'Finance'"*
- *"Create 'Archive-2024' label and move all old work emails there"*
- *"Find all subscription confirmation emails and label them 'Subscriptions'"*
- *"Group all travel booking confirmations under 'Travel' label"*

</details>

<details>
<summary><strong>🔍 Inbox Analysis</strong></summary>

- *"Show me my top 10 email senders by volume this year"*
- *"Find all unread emails older than 1 month"*
- *"List all emails taking up the most storage space"*

</details>

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