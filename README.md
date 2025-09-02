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
5. Navigate to [Data access](https://console.cloud.google.com/auth/scopes) → **Add or remove scopes** → Enter: `https://mail.google.com/`
6. Navigate to [Test users](https://console.cloud.google.com/auth/audience) → Add your Google email

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

</details>

---

## ⚙️ Configure Claude Desktop

<details>
<summary><strong>🔧 Required for all installation methods</strong></summary>

Add to your Claude Desktop config file:
- ![Windows](https://img.shields.io/badge/Windows-dodgerblue?style=flat-square&logo=windows&logoColor=white) `%APPDATA%\\Claude\\claude_desktop_config.json`
- ![macOS](https://img.shields.io/badge/macOS-silver?style=flat-square&logo=apple&logoColor=black) `~/Library/Application Support/Claude/claude_desktop_config.json`
- ![Linux](https://img.shields.io/badge/Linux-gold?style=flat-square&logo=linux&logoColor=black) `~/.config/Claude/claude_desktop_config.json`

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
      "command": "node",
      "args": ["\\path\\to\\GMail-Manager-MCP\\dist\\index.js"]
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
<summary><strong>🧹 Smart Storage Cleanup</strong></summary>

- *"Find and delete duplicate attachments across all emails"*
- *"Remove emails with dead/broken links older than 6 months"*
- *"Delete redundant email chains where I'm CC'd and the conversation continued without me"*
- *"Clean up emails from defunct/expired domains"*
- *"Find and merge split conversation threads"*
- *"Remove emails from companies that no longer exist"*
- *"Delete newsletters from sources I haven't engaged with in the last year"*
- *"Clean up automated emails from services I no longer use"*
- *"Remove duplicate calendar invites and their related email threads"*
- *"Delete notification chains where a final resolution email exists"*

</details>

<details>
<summary><strong>🧠 Intelligent Organization</strong></summary>

- *"Auto-categorize emails by project context using content analysis"*
- *"Group related emails across different senders by topic/project"*
- *"Create smart folders based on my interaction patterns"*
- *"Identify and group conversation threads split across multiple subjects"*
- *"Auto-detect and label emails requiring follow-up based on content"*
- *"Group emails by organizational hierarchy"*
- *"Create dynamic labels based on recurring calendar events"*
- *"Auto-categorize attachments by type and content"*
- *"Group emails by project phases detected from content"*

</details>

<details>
<summary><strong>📊 Advanced Analytics</strong></summary>

- *"Analyze my email response patterns and suggest optimization strategies"*
- *"Identify communication bottlenecks in project-related email threads"*
- *"Show email interaction network map with key stakeholders"*
- *"Generate engagement reports for sent newsletters"*
- *"Analyze meeting scheduling patterns and suggest optimal times"*
- *"Show communication gaps with important contacts"*
- *"Identify peak productivity hours based on email patterns"*
- *"Generate reports on email handling efficiency"*
- *"Show topic evolution over time in long-running threads"*
- *"Analyze sentiment trends in customer communication"*

</details>

<details>
<summary><strong>⚡ Smart Automation</strong></summary>

- *"Auto-summarize long email threads with key decisions and action items"*
- *"Extract and compile all action items from emails into a task list"*
- *"Generate meeting briefs from related email threads"*
- *"Auto-detect and extract recurring reports from emails"*
- *"Create project timelines from email communication history"*
- *"Extract and compile resource links shared across email threads"*
- *"Generate contact engagement reports with communication frequency analysis"*
- *"Auto-create meeting agendas based on previous related emails"*
- *"Compile document version history from email attachments"*

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