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
| ![Analytics](https://img.shields.io/badge/📊-Inbox%20Analytics-blue?style=flat-square) | Get insights about your email patterns and volume |
| ![Read](https://img.shields.io/badge/📖-Read%20Emails-green?style=flat-square) | Read the full content of an email |
| ![Organize](https://img.shields.io/badge/🏷️-Smart%20Organization-yellow?style=flat-square) | Create and apply labels to categorize emails automatically |
| ![Cleanup](https://img.shields.io/badge/🗑️-Bulk%20Cleanup-crimson?style=flat-square) | Remove old newsletters, notifications, and spam efficiently |

Perfect for **inbox zero enthusiasts** and anyone drowning in email overload! 📧💀

## 🚀 Quick Setup

### 📋 Prerequisites: Get Gmail Credentials 🗝️

<details open>
<summary><strong>🔑 Required before any installation</strong></summary>

1. [Create New Project](https://console.cloud.google.com/projectcreate)
2. [Enable Gmail API](https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics)
3. Create [OAuth client ID](https://console.cloud.google.com/auth/clients) (Desktop app type)
4. Download as `gcp-oauth.keys.json`
5. Navigate to [Data access](https://console.cloud.google.com/auth/scopes) → **Add or remove scopes** → Enter these scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.settings.basic`
6. Navigate to [Test users](https://console.cloud.google.com/auth/audience) → Add your Google email

</details>

---

## 📦 Installation Options

<details>
<summary><strong>🚀 Install from npm registry</strong></summary>

```bash
npm install @spark-apps/gmail-manager-mcp
```
</details>

---

<details>
<summary><strong>🏠 Clone and build locally</strong></summary>

   ```bash
   git clone https://github.com/muammar-yacoob/GMail-Manager-MCP.git
   cd GMail-Manager-MCP
   npm install
   ```



</details>

</details>

---

## ⚙️ Configure Claude Desktop

<details>
<summary><strong>🔧 Required for all installation methods</strong></summary>

Add to your Claude Desktop config file:
- ![Windows](https://img.shields.io/badge/Windows-dodgerblue?style=flat-square&logo=windows&logoColor=white) `%APPDATA%\\Claude\\claude_desktop_config.json`
- ![macOS](https://img.shields.io/badge/macOS-silver?style=flat-square&logo=apple&logoColor=black) `~/Library/Application Support/Claude/claude_desktop_config.json`
- ![Linux](https://img.shields.io/badge/Linux-gold?style=flat-square&logo=linux&logoColor=black) `~/.config/Claude/claude_desktop_config.json`

**For NPM Install:**
```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "npx","args": ["@spark-apps/gmail-manager-mcp"]}
  }
}
```

**For Local Development:**

Windows (use double backslashes):
```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "node",
      "args": ["D:\\path\\to\\GMail-Manager-MCP\\dist\\index.js"]
    }
  }
}
```

macOS/Linux:
```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "node",
      "args": ["/path/to/GMail-Manager-MCP/dist/index.js"]
    }
  }
}
```

⚠️ **Important for Windows users**: Use double backslashes (`\\`) in the path!

</details>

## 🛠️ Available Tools

<details>
<summary><strong>🔧 View All Available Tools</strong></summary>

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

</details>

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