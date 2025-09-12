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
[discord-link]: https://discord.gg/S9kS2D5ueg

# <img src="public/images/trash-mail.png" alt="Gmail Manager" width="48" height="48" style="vertical-align: middle;"> Gmail Manager MCP

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

<img src="public/images/meme.png" alt="Stop sending me unnecessary emails meme" width="400">

</div>

## ✨ What It Does

Gmail Manager MCP provides **direct access** to your Gmail inbox through the Model Context Protocol, allowing you to:

| <div align="left">Feature</div> | <div align="left">Description</div> |
|:---------|:-------------|
| ![](https://img.shields.io/badge/🔍%20-1a365d?style=for-the-badge)![Email Search](https://img.shields.io/badge/Email%20Search%20-007bff?style=for-the-badge) | Find emails by sender, subject, date, or any Gmail query |
| ![](https://img.shields.io/badge/📊%20-1a5e3a?style=for-the-badge)![Inbox Analytics](https://img.shields.io/badge/Inbox%20Analytics%20-28a745?style=for-the-badge) | Get insights about your email patterns and volume |
| ![](https://img.shields.io/badge/📖%20-1a5e3a?style=for-the-badge)![Read & Draft Replies](https://img.shields.io/badge/Read%20%26%20Draft%20Replies%20-28a745?style=for-the-badge) | Read the full content of an email |
| ![](https://img.shields.io/badge/🏷️%20-cc6600?style=for-the-badge)![Smart Organization](https://img.shields.io/badge/Smart%20Organization%20-ff9500?style=for-the-badge) | Create and apply labels to categorize emails automatically |
| ![](https://img.shields.io/badge/🗑️%20-c41e3a?style=for-the-badge)![Bulk Cleanup](https://img.shields.io/badge/Bulk%20Cleanup%20-ff073a?style=for-the-badge) | Remove old newsletters, notifications, and spam efficiently |



## 🚀 Quick Setup 

### 📋 Prerequisites: Get Gmail Credentials 🗝️

<details>
<summary><strong>🔑 Required before any installation</strong></summary>

1. [Create New Project](https://console.cloud.google.com/projectcreate) 📁
2. [Enable Gmail API](https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics) 📧
3. Create [OAuth client ID](https://console.cloud.google.com/auth/clients) (Desktop app type) 🔐
4. Download as `gcp-oauth.keys.json` 📥
5. Navigate to [Data access](https://console.cloud.google.com/auth/scopes) → **Add or remove scopes** → Enter: `https://mail.google.com/` 🔓
6. Navigate to [Test users](https://console.cloud.google.com/auth/audience) → Add your Google email 👤

**📁 Where to put `gcp-oauth.keys.json`:**
- **If using npm (npx)**: Place it in your home directory  
  Windows: `%USERPROFILE%` • macOS/Linux: `~/`
- **If running locally from source**: Place it in the project root (same folder as `package.json`)
- **Or set a custom path**: Define `GMAIL_OAUTH_PATH` in your Claude Desktop config to point to the file

</details>

---

## 📥 Installation

<details>
<summary><strong>📦 Install from npm registry (Easier ⚡) </strong></summary>

```bash
npm i -g @spark-apps/gmail-manager-mcp
```
</details>

---

<details>
<summary><strong>🏠 Clone and build locally (Safer 🛡️)</strong></summary>

   ```bash
   git clone https://github.com/muammar-yacoob/GMail-Manager-MCP.git
   cd GMail-Manager-MCP
   npm install
   ```



</details>

---

## 💻 Terminal Usage

<details>
<summary><strong>🖥️ Quick Commands</strong></summary>

```bash
# Install globally
npm i -g @spark-apps/gmail-manager-mcp

# Run directly
npx @spark-apps/gmail-manager-mcp@latest

# Test connection
npx @spark-apps/gmail-manager-mcp@latest --test
```

</details>

---

## ⚙️ Configure MCP Client

<details>
<summary><strong>🔧 Required for all installation methods</strong></summary>

Add to your MCP client config file (Claude Desktop example):
- <span style="background: #1e90ff; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">Windows</span> `%APPDATA%\\Claude\\claude_desktop_config.json`
- <span style="background: #c0c0c0; color: black; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">macOS</span> `~/Library/Application Support/Claude/claude_desktop_config.json`
- <span style="background: #ffd700; color: black; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">Linux</span> `~/.config/Claude/claude_desktop_config.json`

**📦 For NPM Install:**
```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "npx", "args": ["@spark-apps/gmail-manager-mcp@latest"],
      "env": { "GMAIL_OAUTH_PATH": "C:\\path\\to\\gcp-oauth.keys.json" }
    }
  }
}
```

**For Local Development:**
```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "node", "args": ["C:\\path\\to\\GMail-Manager-MCP\\dist\\index.js"]
    }
  }
}
```
</details>

## 🛠️ Available Tools

<details>
<summary><strong>🔧 View All Available Tools</strong></summary>

| <div align="left">Tool</div> | <div align="left">Description</div> |
|:------|:-------------|
| ![](https://img.shields.io/badge/🔐%20-1a365d?style=for-the-badge)![Authenticate Gmail](https://img.shields.io/badge/Authenticate%20Gmail%20-007bff?style=for-the-badge) | Authenticate Gmail access via web browser |
| ![](https://img.shields.io/badge/🔍%20-1a365d?style=for-the-badge)![Search Emails](https://img.shields.io/badge/Search%20Emails%20-007bff?style=for-the-badge) | Search emails using Gmail query syntax |
| ![](https://img.shields.io/badge/📖%20-1a5e3a?style=for-the-badge)![Read Email](https://img.shields.io/badge/Read%20Email%20-28a745?style=for-the-badge) | Read the full content of an email |
| ![](https://img.shields.io/badge/💬%20-1a5e3a?style=for-the-badge)![Create Reply](https://img.shields.io/badge/Create%20Reply%20-28a745?style=for-the-badge) | Create a draft reply to an email with a smart, context-aware response |
| ![](https://img.shields.io/badge/📋%20-1a5e3a?style=for-the-badge)![List Labels](https://img.shields.io/badge/List%20Labels%20-28a745?style=for-the-badge) | List all Gmail labels |
| ![](https://img.shields.io/badge/➕%20-cc6600?style=for-the-badge)![Create Label](https://img.shields.io/badge/Create%20Label%20-ff9500?style=for-the-badge) | Create a new Gmail label |
| ![](https://img.shields.io/badge/🏷️%20-cc6600?style=for-the-badge)![Apply Label](https://img.shields.io/badge/Apply%20Label%20-ff9500?style=for-the-badge) | Apply a label to an email |
| ![](https://img.shields.io/badge/⚡%20-cc6600?style=for-the-badge)![Batch Apply Labels](https://img.shields.io/badge/Batch%20Apply%20Labels%20-ff9500?style=for-the-badge) | Apply labels to multiple emails |
| ![](https://img.shields.io/badge/🚫%20-cc6600?style=for-the-badge)![Remove Label](https://img.shields.io/badge/Remove%20Label%20-ff9500?style=for-the-badge) | Remove a label from an email |
| ![](https://img.shields.io/badge/❌%20-c41e3a?style=for-the-badge)![Delete Label](https://img.shields.io/badge/Delete%20Label%20-ff073a?style=for-the-badge) | Delete a Gmail label |
| ![](https://img.shields.io/badge/🗑️%20-c41e3a?style=for-the-badge)![Delete Email](https://img.shields.io/badge/Delete%20Email%20-ff073a?style=for-the-badge) | Permanently delete an email |
| ![](https://img.shields.io/badge/💥%20-c41e3a?style=for-the-badge)![Batch Delete Emails](https://img.shields.io/badge/Batch%20Delete%20Emails%20-ff073a?style=for-the-badge) | Delete multiple emails at once |

</details>

## 💬 Example Commands

<details>
<summary><strong>🧹 Quick Cleanup</strong></summary>

- *"Delete all promotional emails from last 30 days"*
- *"Delete all unread newsletters older than 1 week"*
- *"Delete all 'no-reply' emails from last 3 months"*
- *"Delete all LinkedIn notification emails"*
- *"Delete all password reset emails older than 1 month"*
- *"Delete redundant email chains where I'm CC'd"*

</details>

<details>
<summary><strong>⚡ Smart Actions</strong></summary>

- *"Summarize email with subject: 'last boring meeting'"*
- *"Summarize all emails about 'project deadline'"*
- *"Reply to email about 'project update' saying 'Got it, thanks!'"*
- *"Label all emails from my bank as 'Finance'"*
- *"Create 'Travel' label and move all booking confirmations"*
- *"Find emails with attachments larger than 5MB"*

</details>

<details>
<summary><strong>📊 Inbox Insights</strong></summary>

- *"Show me who sends me the most emails"*
- *"Find all unread emails older than 1 week"*
- *"Show my busiest email days this month"*
- *"Find emails I starred but never replied to"*

</details>

---

## 🌱 Support & Contributions

⭐ **Star the repo** & I power up like Mario 🍄  
☕ **Devs run on coffee** - [Buy me one?][coffee-link]  
🤝 **Contributions are welcome** - [🍴 Fork][fork-link], improve, PR!  
🎥 **Need help?** <img src="https://img.icons8.com/color/20/youtube-play.png" alt="YouTube" width="20" height="20" style="vertical-align: middle;"> [Setup Tutorial][vid-link] • <img src="https://img.icons8.com/color/20/discord--v2.png" alt="Discord" width="20" height="20" style="vertical-align: middle;"> [Join Discord][discord-link]

## 💖 Sponsor
Your support helps maintain and improve the tool. please consider [sponsoring the project][stars-link]. 


---

<div align="center">


**Made with ❤️ for MCP** • [Privacy Policy](PRIVACY.md) • [Terms of Service](TERMS.md)


</div>
