# Claude Desktop Configuration

## Correct Configuration

Add this to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "gmail-manager": {
      "command": "node",
      "args": ["D:/MCPs/Gmail-MCP-Server/dist/index.js"],
      "env": {
        "GMAIL_OAUTH_PATH": "D:/MCPs/Gmail-MCP-Server/gcp-oauth.keys.json"
      }
    }
  }
}
```

## Important Notes

1. **args must point to the JavaScript file**: The `args` array must contain the path to `dist/index.js`, not just the project directory.

2. **Use forward slashes**: Even on Windows, use forward slashes (/) in the paths.

3. **Build first**: Make sure you've run `npm run build` to compile the TypeScript to JavaScript.

4. **OAuth keys**: Ensure your `gcp-oauth.keys.json` file is in the project root.

## Common Issues

### Server disconnects immediately
- **Wrong path**: Make sure `args` points to `dist/index.js`, not the directory
- **Not built**: Run `npm run build` first
- **File permissions**: Ensure the file is executable

### Authentication errors
- **OAuth keys not found**: Check the `GMAIL_OAUTH_PATH` environment variable
- **Invalid OAuth keys**: Verify your `gcp-oauth.keys.json` has the correct format

## Location of Claude Desktop Config

The configuration file is typically located at:
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`