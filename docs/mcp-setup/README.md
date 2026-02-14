# Trace MCP Server Setup

Connect your AI assistants (Claude, ChatGPT, etc.) to your Trace data using the Model Context Protocol (MCP).

## Two Ways to Connect

### 🎯 For End Users: OAuth (Recommended)

**Best for:** Claude Desktop and most AI assistants

✅ **30-second setup** - no config files, no API keys
✅ **Browser-based sign-in** - just like connecting any app
✅ **Secure** - OAuth 2.1 with PKCE and Dynamic Client Registration (DCR)
✅ **Easy management** - revoke access anytime in Trace settings

**[→ Get Started with Claude Desktop OAuth](./CLAUDE-DESKTOP.md)**

> **Via Claude Desktop UI:** Settings → Connectors → Add Server → Enter URL → Sign in with Trace account → Done!

---

### 🔧 For Developers: API Keys (Advanced)

**Best for:** Automation, scripts, custom integrations

✅ Programmatic access
✅ Use in scripts and automation
✅ Server-to-server integration
✅ Works with Claude Code (stdio proxy)

**[→ Developer Guide](./API-KEYS.md)**

---

## What is MCP?

The **Model Context Protocol** is an industry standard that allows AI assistants to securely connect to external data sources like Trace.

**Supported AI Platforms:**
- ✅ Claude Desktop (Anthropic)
- ✅ ChatGPT Desktop (OpenAI) - *coming soon*
- ✅ Gemini Desktop (Google) - *coming soon*
- ✅ VS Code with Copilot
- ✅ Cursor IDE
- ✅ Any MCP-compatible client

## What Can AI Do With Trace?

Once connected, your AI assistant can:

📖 **Read your entries**
- "Show me what I wrote about project X"
- "Find entries from last week"
- "What are my top priorities?"

✍️ **Create entries**
- "Create a journal entry about today's meeting"
- "Add a todo for tomorrow"
- "Log my workout session"

🗂️ **Organize data**
- "Archive old entries"
- "Move this entry to my Work stream"
- "Tag these entries as completed"

🔍 **Search and analyze**
- "Summarize my entries from this month"
- "Find patterns in my mood tracking"
- "What topics do I write about most?"

## Quick Start by Platform

### Claude Desktop (30 seconds)
1. Open Claude Desktop → **Settings → Connectors**
2. Click **"Add Server"** or **"+"**
3. Enter URL: `https://trace-mcp.mindjig.com/mcp`
4. Browser opens → **Sign in with Trace email/password** → Grant permission
5. Done! Ask Claude: "List my recent Trace entries"

**[Full Instructions →](./CLAUDE-DESKTOP.md)**

### Claude Code (CLI)
Uses API keys with stdio transport for local development

**[Full Instructions →](./SETUP.md)**

### Custom Integration
Use API keys for programmatic access

**[Full Instructions →](./API-KEYS.md)**

## Security

Your data is protected with:
- 🔐 **OAuth 2.1 with PKCE** - Industry-standard authentication
- 🔑 **API key encryption** - bcrypt-hashed, never stored in plaintext
- 🛡️ **Rate limiting** - 100 req/bucket, 10/sec refill
- 🎯 **Scope-based permissions** - Read vs full access
- 🚫 **CORS restrictions** - Only allowed origins can connect

**You control access:**
- Revoke OAuth connections anytime
- Delete API keys instantly
- Monitor usage in Trace Settings

## Available Tools

| Tool | What It Does | Scope Required |
|------|-------------|----------------|
| `list_entries` | Find and filter entries | Read |
| `get_entry` | View entry details | Read |
| `list_streams` | View all streams/notebooks | Read |
| `list_attachments` | See entry attachments | Read |
| `create_entry` | Create new entries | Full |
| `update_entry` | Edit existing entries | Full |
| `delete_entry` | Remove entries | Full |

## Server Information

- **Production URL:** `https://trace-mcp.mindjig.com/mcp`
- **Protocol:** MCP 2025-06-18
- **Server Version:** 1.0.0
- **Authentication:** OAuth 2.1 or API Keys
- **Rate Limits:** 100/bucket, 10/sec refill
- **Status:** [status.trace.app](https://status.trace.app)

## Documentation

- **[OAuth Setup (End Users)](./CLAUDE-DESKTOP.md)** - 30-second setup for Claude Desktop
- **[API Keys (Developers)](./API-KEYS.md)** - Programmatic access for integrations
- **[Claude Code Setup](./SETUP.md)** - stdio proxy for Claude Code CLI

## Troubleshooting

### Connection Issues
- Verify the URL is exactly: `https://trace-mcp.mindjig.com/mcp`
- Check your internet connection
- Try removing and re-adding the server

### Authentication Issues
- **OAuth:** Make sure you're using your Trace login credentials
- **API Keys:** Verify the key starts with `tr_live_` and hasn't been revoked

### Tool Errors
- `"Tool requires 'full' scope"` - Your connection is read-only, create entry with full scope
- `"Rate limit exceeded"` - Wait for the `Retry-After` duration

**[Full Troubleshooting Guide →](./CLAUDE-DESKTOP.md#troubleshooting)**

## Support & Feedback

- 📧 **Email:** support@trace.app
- 💬 **Discord:** [discord.gg/trace](https://discord.gg/trace)
- 🐛 **Bug Reports:** [github.com/trace-app/trace/issues](https://github.com/trace-app/trace/issues)
- 💡 **Feature Requests:** [feedback.trace.app](https://feedback.trace.app)
- 📖 **API Docs:** [docs.trace.app](https://docs.trace.app)

## Changelog

### Version 1.0.0 (2026-02-12)
- ✨ **OAuth 2.1 with Dynamic Client Registration (DCR)** - 30-second setup via Claude Desktop UI
- ✨ **API key authentication** - for developers, automation, and Claude Code CLI
- ✨ **Seven MCP tools** - entries, streams, attachments (create, read, update, delete)
- 🔒 **Security** - PKCE, rate limiting (100/bucket, 10/sec refill), CORS, scope-based permissions (read/full)
- 📝 **Complete documentation** - end users (OAuth), developers (API keys), Claude Code CLI (stdio)

---

**Last updated:** 2026-02-12
**MCP Protocol:** 2025-06-18
**Server Version:** 1.0.0
**Maintainer:** Trace Team
