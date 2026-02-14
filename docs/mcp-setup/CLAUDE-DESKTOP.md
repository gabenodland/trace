# Connecting Trace to Claude Desktop

Connect your Trace account to Claude Desktop in 30 seconds using OAuth (no config files needed!).

> **Two Ways to Connect:**
> - **OAuth (Recommended):** Add via Settings → Connectors UI. Browser opens, you sign in, done. No API keys to manage.
> - **API Keys (Advanced):** Edit config file manually. Better for automation, scripts, and Claude Code CLI.

## Quick Setup (30 seconds) - OAuth via UI

**Easiest method - no config files, no API keys!**

1. Open **Claude Desktop**
2. Go to **Settings → Connectors** (or **Settings → Developer → MCP Servers** on older versions)
3. Click **"Add Server"** or **"+"**
4. Enter the server URL:
   ```
   https://trace-mcp.mindjig.com/mcp
   ```
5. Click **"Connect"** or **"Add"**
6. A browser window will open - **sign in with your Trace email and password**
7. Grant permission (choose **Read** or **Full** scope)
8. Done! You should see **"Trace"** with a **green checkmark**

**Try it:** Ask Claude "List my recent Trace entries"

---

## Advanced Setup - API Keys via Config File

**For developers, automation, or Claude Code CLI (stdio transport)**

### Step 1: Get Your API Key

1. Open the **Trace app**
2. Go to **Settings → API Keys**
3. Click **"Create New Key"**
4. Name it "Claude Desktop"
5. Choose scope: **Read** (safer) or **Full** (if you want Claude to create/edit entries)
6. Click **"Create"**
7. **Copy the key** - starts with `tr_live_`

### Step 2: Configure Claude Desktop

1. Open the config file:
   - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
   - **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add this (replace `YOUR_API_KEY` with your actual key):

```json
{
  "mcpServers": {
    "trace": {
      "url": "https://trace-mcp.mindjig.com/mcp",
      "transport": {
        "type": "http",
        "headers": {
          "Authorization": "Bearer tr_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
        }
      }
    }
  }
}
```

3. Save and restart Claude Desktop

### Step 3: Verify Connection

1. You should see **"Trace"** with a **green checkmark** or **"Connected"** status
2. Try asking Claude: "List my recent Trace entries"

## What Can Claude Do Now?

Once connected, you can ask Claude to interact with your Trace data:

**View your entries:**
- "Show me my recent journal entries"
- "What entries did I create this week?"
- "List all my work-related entries"

**Create entries:**
- "Create a new entry about today's standup meeting"
- "Add a journal entry for my workout session"

**Manage entries:**
- "Update entry XYZ to priority 3"
- "Archive all entries from last month"

**Explore streams:**
- "What streams do I have?"
- "Show me all entries in my Work stream"

## Available Tools

Claude has access to these Trace tools:

| Tool | What It Does |
|------|-------------|
| `list_entries` | Find and filter your entries |
| `get_entry` | View complete entry details |
| `create_entry` | Create new entries |
| `update_entry` | Edit existing entries |
| `delete_entry` | Remove entries |
| `list_streams` | View all your streams/notebooks |
| `list_attachments` | See attachments on entries |

## Access Levels

When you sign in, Claude gets **read-only access** by default. This means Claude can view your entries but cannot modify or delete anything without your explicit permission in each request.

**Read Access:**
- View entries, streams, attachments
- Search and filter your data
- Safe for exploration

**Full Access** (optional):
- Create, update, and delete entries
- Modify streams and settings
- Requires explicit approval when connecting

## Troubleshooting

### "Failed to connect to server"
- Check your internet connection
- Make sure the URL is exactly: `https://trace-mcp.mindjig.com/mcp`
- Try removing and re-adding the server

### "Authentication failed"
- Double-check your Trace email and password
- Make sure you have a Trace account (sign up at trace.app if not)
- Try the forgot password flow if needed

### "Server not responding"
- The Trace MCP server might be temporarily down
- Wait a minute and try reconnecting
- Check [status.trace.app](https://status.trace.app) for server status

### Need to reconnect?
1. Go to Settings → Developer → MCP Servers
2. Click the **"Disconnect"** button next to Trace
3. Click **"Connect"** again
4. Sign in again in the browser

## Security & Privacy

### Your data is safe:
- **OAuth 2.1 with PKCE** - Industry-standard secure authentication
- **No API keys to manage** - Your Trace password is never shared with Claude Desktop
- **You control access** - Revoke access anytime in Trace Settings
- **Read-only by default** - Claude can't modify data without explicit permission

### How it works:
1. Claude Desktop discovers the Trace OAuth configuration
2. Opens your browser to Trace's secure login page
3. You sign in with your Trace credentials (happens on Trace's server)
4. Trace issues a secure access token to Claude Desktop
5. Claude Desktop uses that token to access your data

### Revoke access:
- Go to **Trace Settings → Connected Apps**
- Find **Claude Desktop**
- Click **"Revoke Access"**

## For Developers: Using API Keys Instead

If you're building integrations or need programmatic access, use API keys instead of OAuth:

1. Go to **Trace Settings → API Keys**
2. Click **"Create New Key"**
3. Copy the key (starts with `tr_live_`)
4. See [API-KEYS.md](./API-KEYS.md) for how to use it

API keys are better for:
- Automation and scripts
- Server-to-server integrations
- CI/CD pipelines
- Custom tools and integrations

OAuth is better for:
- End users connecting desktop apps
- No technical setup required
- Easily revocable access
- More secure for personal use

## Support

Need help?
- 📧 Email: support@trace.app
- 💬 Discord: [discord.gg/trace](https://discord.gg/trace)
- 🐛 Report bugs: [github.com/trace-app/trace/issues](https://github.com/trace-app/trace/issues)

---

**Last updated:** 2026-02-12
**MCP Server Version:** 1.0.0
**Supported Platforms:** Claude Desktop (macOS, Windows, Linux)
