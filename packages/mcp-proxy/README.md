# @trace-app/mcp-proxy

MCP (Model Context Protocol) proxy for connecting Claude Code to Trace.

## Why This Exists

Claude Code's HTTP MCP transport has [known bugs](https://github.com/anthropics/claude-code/issues/9492) that prevent direct connection to HTTP MCP servers. This proxy bridges Claude Code's stdio transport to the Trace MCP server over HTTP.

## Quick Setup

1. **Get your API key** from Trace app: Settings → API Keys → Create New Key

2. **Add to your project's `.mcp.json`** (or `~/.claude.json` for global access):

```json
{
  "mcpServers": {
    "trace": {
      "command": "npx",
      "args": ["-y", "@trace-app/mcp-proxy"],
      "env": {
        "TRACE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

3. **Verify the connection**:
```bash
claude mcp list
```

You should see:
```
trace: npx -y @trace-app/mcp-proxy - ✓ Connected
```

## Available Tools

Once connected, Claude Code will have access to these Trace tools:

- `list_entries` - List your entries with filtering
- `get_entry` - Get full details of an entry
- `create_entry` - Create a new entry
- `update_entry` - Update an existing entry
- `delete_entry` - Delete an entry
- `list_streams` - List your streams
- `list_attachments` - List attachments on an entry

## Requirements

- Node.js 18 or higher (usually pre-installed with Claude Code)
- A Trace account with an API key

## Troubleshooting

### "TRACE_API_KEY environment variable is required"
Make sure you have the `env` section in your `.mcp.json` config with your API key.

### "Invalid or revoked API key"
Your API key may have been revoked or expired. Create a new one in Trace Settings.

### Connection timeout
Check your internet connection. The Trace MCP server is hosted on Supabase Edge Functions.

## License

MIT
