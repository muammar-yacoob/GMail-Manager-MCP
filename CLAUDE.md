# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Rules

### GitHub
- Use GitHub MCP only to read and bisect to find previous commits that worked but never commit or push to origin
- After fixes, always suggest concise commit messages of one brief line only with "fix:", "feat:" prefixes when necessary for deployment focusing on the main change, not implementation details

### Communication
- Be direct & concise
- Minimize explanatory text
- Answer what was asked, nothing more

### Code Changes
- Read files before editing
- Follow existing patterns
- Test changes before suggesting commits

## Project Overview

Gmail Manager MCP is a Model Context Protocol (MCP) server that provides Gmail integration for Claude Desktop. It enables Gmail management through tools for searching, reading, deleting emails, and managing labels.

## Development Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript in `dist/`
- **Build (watch)**: `npm run build:watch` - Continuous compilation during development
- **Start server**: `npm start` or `node dist/index.js` - Runs the MCP server
- **Authentication**: `npm run auth` - Interactive OAuth2 setup for Gmail API
- **Debug auth**: `npm run debug-auth` - Validates existing credentials
- **Test locally**: `./test-local.sh` - Comprehensive local testing script

## Architecture

The codebase follows a modular TypeScript architecture:

### Core Files
- **`src/index.ts`**: Main server entry point, handles MCP protocol setup and dual transport modes (stdio for local, HTTP for containers)
- **`src/auth.ts`**: OAuth2 authentication flow with Google APIs, handles credential storage in `~/.gmail-mcp/`
- **`src/gmail-service.ts`**: Gmail API wrapper with batch operations for emails and labels
- **`src/tools.ts`**: MCP tool definitions and request handlers

### Key Architectural Patterns
- **Dual Transport Support**: Automatically switches between stdio (local development) and HTTP (container deployments) based on environment
- **Lazy Authentication**: Credentials are loaded only when needed, with automatic browser-based OAuth flow on first tool call
- **Batch Operations**: Email operations use batched API calls (50 items per batch) for efficiency
- **Error Resilience**: Graceful handling of missing credentials, failed operations, and partial batch failures

### Authentication Flow
1. OAuth keys (`gcp-oauth.keys.json`) must be provided via `GMAIL_OAUTH_PATH` environment variable or placed in project root
2. First tool call triggers automatic authentication if no saved credentials exist
3. Credentials are saved in `~/.gmail-mcp/credentials.json` for reuse
4. Manual pre-authentication available via `npm run auth` command

### Gmail API Integration
- Uses Google APIs Node.js client with OAuth2
- Supports Gmail scopes: `gmail.modify` and `gmail.settings.basic`
- Implements email search, read, delete, and label management operations
- Extracts email content from both plain text and HTML MIME parts

## Environment Setup

Required environment variable:
- `GMAIL_OAUTH_PATH`: Path to Google Cloud OAuth2 credentials file

Optional environment variables:
- `GMAIL_CREDENTIALS_PATH`: Custom path for saved credentials (defaults to `~/.gmail-mcp/credentials.json`)
- `PORT` or `USE_HTTP`: Enables HTTP mode for container deployments
- `NODE_ENV=production`: Suppresses development logging

## Testing

The project includes a comprehensive test script (`test-local.sh`) that validates:
- Build process
- Server startup in both stdio and HTTP modes
- Tool listing via MCP protocol
- Authentication setup and credential validation
- Docker image building (if Docker available)

For interactive MCP testing: `npx @modelcontextprotocol/inspector dist/index.js`

## Deployment Considerations

- **Local Development**: Uses stdio transport, requires manual OAuth setup
- **Container Deployment**: Uses HTTP transport on specified PORT, requires OAuth keys mounted or provided via environment
- **Smithery Integration**: Supports web-based installation with OAuth key upload
- **NPM Package**: Designed for `npx` installation with environment-based configuration