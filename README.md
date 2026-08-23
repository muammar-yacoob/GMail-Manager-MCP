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
[discord-link]: https://discord.gg/dDnNNXSWJQ

# <img src="public/images/trash-mail.png" alt="Gmail Manager" width="48" height="48" style="vertical-align: middle;"> Gmail Manager MCP

<div align="center">

**🧹 Clean your inbox • 🏷️ Organize with labels • 🗑️ Bulk delete emails**


[![npm](https://img.shields.io/npm/v/@spark-apps/gmail-manager-mcp?style=flat-square&logo=npm&logoColor=white&color=crimson)](https://www.npmjs.com/package/@spark-apps/gmail-manager-mcp)
[![MCP Server](https://badge.mcpx.dev?type=server&color=blue&labelColor=gray)](https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp)
[![MIT](https://img.shields.io/badge/License-MIT-blueviolet?style=flat-square)](LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/muammar-yacoob?label=Sponsor&logo=github-sponsors&logoColor=white&color=hotpink)](https://github.com/sponsors/muammar-yacoob)
[![Report Bug](https://img.shields.io/badge/Report-Bug-orangered?logo=github&logoColor=white)][issues-link]
[![GitHub Stars](https://img.shields.io/github/stars/muammar-yacoob/GMail-Manager-MCP?style=social)][stars-link]
<!-- [![Buy Me Coffee](https://img.shields.io/badge/Buy%20Me-Coffee-limegreen?logo=buy-me-a-coffee&logoColor=white)][coffee-link] -->
<!-- [![Downloads](https://img.shields.io/github/downloads/muammar-yacoob/GMail-Manager-MCP/total?logo=cloud-download&logoColor=white&color=dodgerblue)][release-link] -->

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
| ![](https://img.shields.io/badge/📅%20-4b2e83?style=for-the-badge)![Google Calendar](https://img.shields.io/badge/Google%20Calendar%20-7b4fc9?style=for-the-badge) | List, search, create and update events, RSVP, and find times everyone is free |
| ![](https://img.shields.io/badge/📎%20-1a365d?style=for-the-badge)![Attachments](https://img.shields.io/badge/Attachments%20-007bff?style=for-the-badge) | Attach local files to drafts, download attachments, or file them into Drive |



> [!IMPORTANT]
> **Upgrading from a version before calendar or Drive support?** Google cannot add scopes to a token it has already issued, so your saved credentials keep working for mail while calendar calls and `save_attachment_to_drive` fail with a permissions error. Enable the Calendar and Drive APIs and add their scopes as below, then re-authenticate once:
> ```bash
> npx @spark-apps/gmail-manager-mcp@latest auth
> ```
> Running a local checkout instead of the published package? Re-authenticate with the build your client actually loads, or you will re-consent against whichever version npm is serving and see the same error:
> ```bash
> node /path/to/GMail-Manager-MCP/dist/index.js auth
> ```

## 🚀 Quick Setup 

### 📋 Prerequisites: Get Gmail Credentials 🗝️

<details>
<summary><strong>🔑 Required before any installation</strong></summary>

1. [Create New Project](https://console.cloud.google.com/projectcreate) 📁
2. Enable all three APIs: [Gmail](https://console.cloud.google.com/apis/api/gmail.googleapis.com/metrics) 📧, [Calendar](https://console.cloud.google.com/apis/api/calendar-json.googleapis.com/metrics) 📅 and [Drive](https://console.cloud.google.com/apis/api/drive.googleapis.com/metrics) 📁
3. Create [OAuth client ID](https://console.cloud.google.com/auth/clients) (Desktop app type) 🔐
4. Download as `gcp-oauth.keys.json` 📥
5. Navigate to [Data access](https://console.cloud.google.com/auth/scopes) → **Add or remove scopes** → add **all three**: `https://mail.google.com/`, `https://www.googleapis.com/auth/calendar` and `https://www.googleapis.com/auth/drive.file` 🔓
6. Navigate to [Test users](https://console.cloud.google.com/auth/audience) → Add your Google email 👤

**📁 Where to put `gcp-oauth.keys.json`:**

**For Windows users in WSL:**
```bash
# Copy from Windows to current directory
cp /mnt/c/Users/YourUsername/gcp-oauth.keys.json ./gcp-oauth.keys.json
```

**General locations:**
- **Current directory**: `./gcp-oauth.keys.json` (works everywhere)
- **Home directory**: `~/gcp-oauth.keys.json` (for npx usage)
- **Custom path**: Set `GMAIL_OAUTH_PATH` environment variable

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

# Setup authentication (run this first)
npx @spark-apps/gmail-manager-mcp@latest auth

# Test MCP server (for debugging)
npx @modelcontextprotocol/inspector npx @spark-apps/gmail-manager-mcp@latest
```

</details>

---

## ⚙️ Configure MCP Client

<details>
<summary><strong>🔧 Required for MCP client integration</strong></summary>

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

### 📬 Reading

| Tool | Description |
|:-----|:------------|
| `search_emails` | Search using Gmail query syntax |
| `read_email` | Full content of one email |
| `get_thread` | Every message in a conversation, oldest first |

### 🧹 Cleaning up

| Tool | Description |
|:-----|:------------|
| `trash_emails` | Move to Trash — recoverable for 30 days. **Prefer this** |
| `untrash_emails` | Pull messages back out of Trash |
| `archive_emails` | Remove from inbox, keep everything else |
| `mark_emails` | Mark read or unread |
| `delete_email` / `batch_delete_emails` | Permanent, bypasses Trash, cannot be undone |

### 🏷️ Labels

| Tool | Description |
|:-----|:------------|
| `list_labels` | List all labels |
| `create_label` | Create a label, or return the existing one if the name is taken |
| `delete_label` | Delete a label |
| `apply_label` / `remove_label` | One message |
| `batch_apply_labels` / `batch_remove_labels` | Many messages, throttled and retried |

### ⚙️ Rules & unsubscribing

| Tool | Description |
|:-----|:------------|
| `list_filters` | Filters (rules) currently on the account |
| `create_filter` | Set a rule that applies to mail arriving from now on |
| `delete_filter` | Remove a filter |
| `get_unsubscribe_info` | Read a sender's List-Unsubscribe link, without clicking it |
| `unsubscribe_email` | Opt out of a mailing list via the sender's own one-click endpoint |

### ✍️ Drafts

Everything here writes to Drafts. Nothing is delivered — see [Sending](#-sending) below.

| Tool | Description |
|:-----|:------------|
| `create_draft` | Compose to any To/Cc/Bcc with subject, body and attachments. Not tied to a thread |
| `create_reply` | Draft a threaded reply. Recipient can be overridden with `to`/`cc`/`bcc` |
| `update_draft` | Edit a draft **in place**, keeping its ID and URL. Pass only the fields you are changing |
| `delete_draft` | Throw a draft away, so a superseded version cannot be sent by mistake |
| `list_drafts` | Every draft with its ID, recipients, subject and snippet |

Three things these do that are worth knowing about:

**Every draft reports the recipient Gmail actually stored**, read back from the
saved message rather than echoed from the request. A wrong address is visible
before anyone presses send, which is the only moment it can still be fixed.

**A draft addressed only to yourself is called out.** `create_reply` used to
answer the `From` header unconditionally, so replying to your own sent mail
resolved the recipient to your own address: the draft looked perfectly correct
and would have gone nowhere. Replying to a message you sent now answers its
original recipients instead, and says which rule it applied.

**`update_draft` merges rather than replaces.** Gmail's API has no partial
update, so the underlying call rewrites the whole message; the tool reads the
draft first and keeps every field you did not pass, attachments included.

### 📎 Attachments

| Tool | Description |
|:-----|:------------|
| `list_attachments` | Attachments on a message, with the IDs needed to fetch them |
| `download_attachment` | Save one to a local path. Missing directories are created |
| `save_attachment_to_drive` | Upload one straight to Google Drive, optionally into a folder |

Outgoing attachments are local file paths — `~` is expanded — assembled into a
proper MIME multipart message and sent base64url-encoded via `raw`.

Gmail's 25 MB ceiling applies to the *encoded* message, and base64 adds about a
third, so the real limit is roughly **18 MB of actual files**. Oversized
attachments are refused up front, with the per-file arithmetic, rather than
being uploaded and rejected by Google with an opaque 400.

`save_attachment_to_drive` needs the Drive scope — see [Scopes](#-scopes).

### 📤 Sending

**Off by default.** This server composes; a human sends. A draft can be read,
corrected or thrown away; a sent message cannot, because SMTP has no recall.

To enable delivery, set `GMAIL_ENABLE_SEND=1` in the server's environment and
restart your MCP client:

```json
"env": { "GMAIL_ENABLE_SEND": "1" }
```

That adds three tools:

| Tool | Description |
|:-----|:------------|
| `send_email` | Compose and send immediately |
| `send_draft` | Send an existing draft |
| `resend_email` | Send a fresh copy of a sent message (does not recall the original) |

### 📅 Calendar

| Tool | Description |
|:-----|:------------|
| `list_calendars` | Calendars this account can access |
| `list_events` | Events on a calendar, optionally in a time range |
| `search_events` | Find events by keyword |
| `get_event` | One event in full, including RSVPs |
| `create_event` | Create an event, optionally with Meet link and guests |
| `update_event` | Change an event; only the fields you pass are altered |
| `delete_event` | Delete an event |
| `respond_to_event` | RSVP as yourself |
| `suggest_time` | Find slots where everyone is free, via free/busy |

### 🔐 Auth

| Tool | Description |
|:-----|:------------|
| `authenticate_gmail` | Authenticate via browser. Covers Gmail, Calendar **and** Drive |

</details>

## 🔑 Scopes

| Scope | Why |
|:------|:----|
| `https://mail.google.com/` | Read, label, draft, trash and permanently delete mail |
| `https://www.googleapis.com/auth/calendar` | Calendar tools |
| `https://www.googleapis.com/auth/drive.file` | `save_attachment_to_drive` |

Drive is requested as `drive.file`, not the full `drive` scope: it grants rights
over the files this app creates and nothing else, so the server cannot read,
list or alter anything already in your Drive.

The trade-off is worth knowing. Because the app never gains rights over folders
it did not create, passing a `folderId` for a folder you made in the Drive web
UI can come back as "not found" even though it plainly exists. When that
happens the file is uploaded to My Drive instead and the result says so, rather
than the upload being lost.

**Changing this list invalidates existing credentials.** Google will not add
scopes to a refresh token it has already issued, so a token predating a scope
keeps working for everything else while the new feature returns a bare 403. The
tools detect that case and tell you to re-run authentication:

```bash
npx @spark-apps/gmail-manager-mcp@latest auth
```

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

<details>
<summary><strong>📅 Calendar</strong></summary>

- *"What's on my calendar this week?"*
- *"Find a 45-minute slot next week when Sam and I are both free, weekdays 9-5"*
- *"Move Thursday's standup to 10am and add a Meet link"*
- *"Decline the Friday review, comment that I'm on leave"*
- *"Search my calendar for anything about the tax deadline"*

</details>

<details>
<summary><strong>🛡️ Rules &amp; Unsubscribing</strong></summary>

- *"Show me the rules currently on my account"*
- *"Rule: anything from noreply@ skips the inbox and gets labelled Noise"*
- *"Get the unsubscribe link for this sender so I can check it before clicking"*
- *"Unsubscribe me from this newsletter"*

Unsubscribing uses the sender's own published opt-out. Where they support one-click
(RFC 8058) it completes on its own; where the only route is emailing them, it asks
first, since that sends mail from your account. A plain link with no one-click
declaration is handed back for you to open — arbitrary URLs found in mail are never
visited, and no response body from a sender is ever read back into the conversation.

</details>

---

## 🌱 Support & Contributions

⭐ **Star the repo** & I power up like Mario 🍄  
☕ **Devs run on coffee** - [Buy me one?][coffee-link]  
💰 **Crypto tips welcome** - [Tip in crypto](https://tip.md/muammar-yacoob)  
🤝 **Contributions are welcome** - [🍴 Fork][fork-link], improve, PR!  
🎥 **Need help?** <img src="https://img.icons8.com/color/20/youtube-play.png" alt="YouTube" width="20" height="20" style="vertical-align: middle;"> [Setup Tutorial][vid-link] • <img src="https://img.icons8.com/color/20/discord--v2.png" alt="Discord" width="20" height="20" style="vertical-align: middle;"> [Join Discord][discord-link]

## 💖 Sponsor
Your support helps maintain and improve the tool. please consider [sponsoring the project][stars-link]. 


---

<div align="center">


**Made with ❤️ for MCP** • [Privacy Policy](PRIVACY.md) • [Terms of Service](TERMS.md)


</div>
