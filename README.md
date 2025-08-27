# 📧 Gmail Manager MCP

<div align="center">

[![MCP Server](https://badge.mcpx.dev?type=server)](https://modelcontextprotocol.io)
[![Gmail](https://img.shields.io/badge/Gmail-EA4335?style=flat-square&logo=gmail&logoColor=white)](https://developers.google.com/gmail/api)
[![Smithery](https://smithery.ai/badge/gmail-manager)](https://smithery.ai/server/gmail-manager)
[![MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Clean your inbox • Organize with labels • Bulk delete emails**

</div>

## ⚡ Quick Setup

### 1. Get Gmail credentials
- Visit [Google Cloud Console](https://console.cloud.google.com/)
- Enable Gmail API → Create OAuth 2.0 Desktop credentials → Download as `gcp-oauth.keys.json`

### 2. Install via Smithery
```bash
npx @smithery/cli install gmail-manager --client claude
```

### 3. First run
Place `gcp-oauth.keys.json` in your working directory. Claude will authenticate automatically.

## 🛠️ Tools

`search_emails` • `read_email` • `delete_email` • `batch_delete_emails` • `list_labels` • `create_label` • `delete_label` • `apply_label` • `remove_label` • `batch_apply_labels`

## 💬 Example Commands

- *"Delete all emails older than 1 year"*
- *"Find unread newsletters"*
- *"Label emails from boss@company.com as Important"*

---

<div align="center">
<a href="https://smithery.ai/server/gmail-manager">Get on Smithery</a> • Made for Claude Desktop
</div>