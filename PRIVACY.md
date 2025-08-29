# Privacy Policy for Gmail Manager MCP

*Last updated: January 2025*

## Overview

Gmail Manager MCP is a Model Context Protocol (MCP) server that helps you manage your Gmail inbox. This privacy policy explains how we handle your data when you use our application.

## Data Collection and Usage

### What We Access
- **Gmail Data**: When you authorize the application, it can access your Gmail emails, labels, and basic account information as specified by these OAuth scopes:
  - `https://www.googleapis.com/auth/gmail.modify` - for reading, sending, deleting, and modifying emails and labels
  - `https://www.googleapis.com/auth/gmail.settings.basic` - for accessing basic Gmail settings
- **Local Configuration**: OAuth credentials and authentication tokens are stored locally on your device.

### What We Don't Collect
- **No Data Transmission**: Gmail Manager MCP runs entirely on your local machine. We do not collect, store, or transmit your email data to any external servers.
- **No Analytics**: We do not collect usage analytics, tracking data, or personal information.
- **No Third-Party Sharing**: Your Gmail data is never shared with third parties.

## Data Storage

### Local Storage Only
- **OAuth Credentials**: Stored in `~/.gmail-mcp/credentials.json` on your local machine
- **Configuration Files**: OAuth keys (`gcp-oauth.keys.json`) are stored locally as specified by you
- **No Cloud Storage**: No data is stored on our servers or in the cloud

### Data Security
- All authentication uses Google's OAuth 2.0 standard security protocols
- Credentials are stored locally using Google's recommended security practices
- Communication with Gmail uses HTTPS encryption

## Data Retention

- **Local Control**: You have complete control over your data since it's stored locally
- **Data Deletion**: Uninstalling the application or deleting the `~/.gmail-mcp/` directory removes all stored credentials
- **Revoke Access**: You can revoke the application's access to your Gmail account at any time through your [Google Account settings](https://myaccount.google.com/permissions)

## Third-Party Services

### Google Services
- We use Google's Gmail API and OAuth 2.0 services
- Google's privacy policy applies to their services: https://policies.google.com/privacy
- Authentication is handled directly by Google's secure OAuth flow

### No Other Third Parties
- We do not use analytics services, advertising networks, or other third-party data processors
- The application operates entirely between your local machine and Google's services

## Your Rights

You have the right to:
- **Access**: Review what data the application has access to through your Google Account settings
- **Revoke**: Remove the application's access to your Gmail account at any time
- **Delete**: Remove all local application data by deleting configuration files
- **Control**: Manage which Gmail features the application can access

## Contact

If you have questions about this privacy policy or our data practices:
- **GitHub Issues**: [Report issues or ask questions](https://github.com/muammar-yacoob/GMail-Manager-MCP/issues)
- **Email**: Contact the project maintainers through GitHub

## Changes to This Policy

We may update this privacy policy from time to time. Any changes will be posted in this file with an updated "Last updated" date. Continued use of the application after changes constitutes acceptance of the updated policy.

## Open Source

Gmail Manager MCP is open source software. You can review the complete source code to understand exactly how your data is handled: https://github.com/muammar-yacoob/GMail-Manager-MCP
