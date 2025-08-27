# 📧 Gmail Manager MCP

<div align="center">

[![MCP Server](https://badge.mcpx.dev?type=server)](https://modelcontextprotocol.io)
[![Gmail](https://img.shields.io/badge/Gmail-EA4335?style=flat-square&logo=gmail&logoColor=white)](https://developers.google.com/gmail/api)
[![Smithery](https://smithery.ai/badge/@muammar-yacoob/gmail-manager-mcp)](https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp)
[![MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

**Clean your inbox • Organize with labels • Bulk delete emails**

<img src=".github/assets/meme.png" alt="Stop sending me unnecessary emails meme" width="400">

</div>

## ⚡ Quick Setup

### 1. Get Gmail credentials
- Visit [Google Cloud Console](https://console.cloud.google.com/)
- Enable Gmail API → Create OAuth 2.0 Desktop credentials → Download as `gcp-oauth.keys.json`

### 2. Install via Smithery
```bash
npx @smithery/cli install @muammar-yacoob/gmail-manager-mcp --client claude
```

**Alternative: Manual Claude Desktop config**
```json
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

### 3. First run
Place `gcp-oauth.keys.json` in your working directory. Claude will authenticate automatically.

## 🛠️ Tools

`search_emails` • `read_email` • `delete_email` • `batch_delete_emails` • `list_labels` • `create_label` • `delete_label` • `apply_label` • `remove_label` • `batch_apply_labels`

## 💬 Example Commands

- *"Find and label newsletter emails for review"*
- *"Show me potentially spam messages to check"*
- *"Delete all linkedIn and social media notifications"*
- *"Delete all emails from domain.com"*
- *"Delete all emails from amazon.com that are older than one year"*

---

<div align="center">
<a href="https://smithery.ai/server/@muammar-yacoob/gmail-manager-mcp">Get on Smithery</a> • Made for Claude Desktop
</div>