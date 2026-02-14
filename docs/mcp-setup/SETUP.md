# Setting Up Trace MCP for Claude Code

Connect Claude Code to your Trace data using MCP (Model Context Protocol).

## Prerequisites

- [Claude Code](https://claude.ai/code) installed
- Node.js 18+ installed
- A Trace account with an API key

## Quick Setup (2 minutes)

### Step 1: Get Your API Key

1. Open the Trace app
2. Go to **Settings → API Keys**
3. Click **Create New Key**
4. Copy the key (starts with `tr_live_`)

### Step 2: Download the MCP Proxy

Run this command in your terminal:

**macOS/Linux:**
```bash
mkdir -p ~/.trace && curl -sSL https://raw.githubusercontent.com/[your-org]/trace/main/packages/mcp-proxy/index.js -o ~/.trace/mcp-proxy.js
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.trace" | Out-Null; Invoke-WebRequest -Uri "https://raw.githubusercontent.com/[your-org]/trace/main/packages/mcp-proxy/index.js" -OutFile "$env:USERPROFILE\.trace\mcp-proxy.js"
```

### Step 3: Configure Claude Code

Add this to your `~/.claude.json` (or project's `.mcp.json`):

**macOS/Linux:**
```json
{
  "mcpServers": {
    "trace": {
      "command": "node",
      "args": ["~/.trace/mcp-proxy.js"],
      "env": {
        "TRACE_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**Windows:**
```json
{
  "mcpServers": {
    "trace": {
      "command": "node",
      "args": ["C:\\Users\\YOUR_USERNAME\\.trace\\mcp-proxy.js"],
      "env": {
        "TRACE_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

Replace `YOUR_API_KEY_HERE` with your actual API key.

### Step 4: Verify Connection

```bash
claude mcp list
```

You should see:
```
trace: node ~/.trace/mcp-proxy.js - ✓ Connected
```

## Available Commands

Once connected, Claude Code can:

| Tool | Description |
|------|-------------|
| `list_entries` | List your entries with filters |
| `get_entry` | Get full entry details |
| `create_entry` | Create a new entry |
| `update_entry` | Update an existing entry |
| `delete_entry` | Delete an entry |
| `list_streams` | List your streams |
| `list_attachments` | List entry attachments |

## Example Usage

In Claude Code, you can ask:

- "Show me my recent entries"
- "Create a new entry about today's meeting"
- "Update entry XYZ with a higher priority"
- "What streams do I have?"

## Troubleshooting

### "TRACE_API_KEY environment variable is required"
Make sure the `env` section is in your config with your API key.

### "Invalid or revoked API key"
Create a new key in Trace Settings → API Keys.

### "Failed to connect"
1. Check your internet connection
2. Verify Node.js is installed: `node --version`
3. Verify the proxy file exists at the path in your config

## Why stdio instead of HTTP?

Claude Code's HTTP MCP transport has [known bugs](https://github.com/anthropics/claude-code/issues/9492). This proxy uses the stdio transport which works reliably.

## Security

- Your API key is stored locally in your config file
- The proxy only connects to Trace's servers
- API keys can be revoked anytime in Trace Settings
