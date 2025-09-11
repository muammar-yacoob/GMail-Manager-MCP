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

<style>
/* Gmail Manager MCP Badge Styles */
.badge {
  display: inline-flex;
  width: 180px;
  height: 24px;
  border-radius: 4px;
  overflow: hidden;
  vertical-align: middle;
}

/* Ensure consistent table row heights */
table tr {
  height: 32px;
}

table td {
  vertical-align: middle;
  padding: 4px 12px;
}

table td:first-child {
  padding-right: 20px;
}

.badge-os {
  width: 80px;
  padding-left: 8px;
}

.badge-emoji {
  width: 32px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.badge-text {
  flex: 1;
  height: 24px;
  display: flex;
  align-items: center;
  padding-left: 8px;
  color: white;
  font-size: 11px;
  font-weight: bold;
}

/* Color variants with gradients */
.badge-blue { background: linear-gradient(90deg, #007acc 0%, #0056b3 100%); }
.badge-blue-dark { background: #003d82; }

.badge-green { background: linear-gradient(90deg, #28a745 0%, #1e7e34 100%); }
.badge-green-dark { background: #155724; }

.badge-yellow { background: linear-gradient(90deg, #ffc107 0%, #e0a800 100%); }
.badge-yellow-dark { background: #b8860b; }

.badge-red { background: linear-gradient(90deg, #dc3545 0%, #c82333 100%); }
.badge-red-dark { background: #a71e2a; }

/* OS-specific badges */
.badge-windows { 
  background: #1e90ff; 
  text-align: center;
  line-height: 24px;
  color: white;
  font-size: 11px;
  font-weight: bold;
}

.badge-macos { 
  background: #c0c0c0; 
  text-align: center;
  line-height: 24px;
  color: black !important; 
  font-size: 11px;
  font-weight: bold;
}

.badge-linux { 
  background: #ffd700; 
  text-align: center;
  line-height: 24px;
  color: black !important; 
  font-size: 11px;
  font-weight: bold;
}
</style>

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

Gmail Manager MCP gives Claude Desktop **direct access** to your Gmail inbox, allowing you to:

| Feature | Description |
|---------|-------------|
| ![Email Search](https://img.shields.io/badge/🔍%20Email%20Search-blue?style=for-the-badge) | Find emails by sender, subject, date, or any Gmail query |
| ![Inbox Analytics](https://img.shields.io/badge/📊%20Inbox%20Analytics-blue?style=for-the-badge) | Get insights about your email patterns and volume |
| ![Read & Draft Replies](https://img.shields.io/badge/📖%20Read%20%26%20Draft%20Replies-green?style=for-the-badge) | Read the full content of an email |
| ![Smart Organization](https://img.shields.io/badge/🏷️%20Smart%20Organization-yellow?style=for-the-badge) | Create and apply labels to categorize emails automatically |
| ![Bulk Cleanup](https://img.shields.io/badge/🗑️%20Bulk%20Cleanup-red?style=for-the-badge) | Remove old newsletters, notifications, and spam efficiently |



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

## ⚙️ Configure Claude Desktop

<details>
<summary><strong>🔧 Required for all installation methods</strong></summary>

Add to your Claude Desktop config file:
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

| Tool | Description |
|------|-------------|
| ![Authenticate Gmail](https://img.shields.io/badge/🔐%20Authenticate%20Gmail-blue?style=for-the-badge) | Authenticate Gmail access via web browser |
| ![Search Emails](https://img.shields.io/badge/🔍%20Search%20Emails-blue?style=for-the-badge) | Search emails using Gmail query syntax |
| ![Read Email](https://img.shields.io/badge/📖%20Read%20Email-green?style=for-the-badge) | Read the full content of an email |
| ![Create Reply](https://img.shields.io/badge/💬%20Create%20Reply-green?style=for-the-badge) | Create a draft reply to an email with a smart, context-aware response |
| ![List Labels](https://img.shields.io/badge/📋%20List%20Labels-green?style=for-the-badge) | List all Gmail labels |
| ![Create Label](https://img.shields.io/badge/➕%20Create%20Label-yellow?style=for-the-badge) | Create a new Gmail label |
| ![Apply Label](https://img.shields.io/badge/🏷️%20Apply%20Label-yellow?style=for-the-badge) | Apply a label to an email |
| ![Batch Apply Labels](https://img.shields.io/badge/⚡%20Batch%20Apply%20Labels-yellow?style=for-the-badge) | Apply labels to multiple emails |
| ![Remove Label](https://img.shields.io/badge/🚫%20Remove%20Label-yellow?style=for-the-badge) | Remove a label from an email |
| ![Delete Label](https://img.shields.io/badge/❌%20Delete%20Label-red?style=for-the-badge) | Delete a Gmail label |
| ![Delete Email](https://img.shields.io/badge/🗑️%20Delete%20Email-red?style=for-the-badge) | Permanently delete an email |
| ![Batch Delete Emails](https://img.shields.io/badge/💥%20Batch%20Delete%20Emails-red?style=for-the-badge) | Delete multiple emails at once |

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


**Made with ❤️ for Claude Desktop** • [Privacy Policy](PRIVACY.md) • [Terms of Service](TERMS.md)

</div>