# Using Trace MCP with API Keys (Developers)

For automation, scripts, and integrations, use API keys instead of OAuth.

## When to Use API Keys vs OAuth

| Scenario | Use This |
|----------|---------|
| End user connecting Claude Desktop | **OAuth** (see [CLAUDE-DESKTOP.md](./CLAUDE-DESKTOP.md)) |
| Building scripts/automation | **API Keys** |
| CI/CD pipelines | **API Keys** |
| Server-to-server integration | **API Keys** |
| Custom tools and bots | **API Keys** |

## Getting an API Key

1. Open the Trace app
2. Go to **Settings → API Keys**
3. Click **"Create New Key"**
4. Give it a name (e.g., "Claude Code", "Automation", "CI Pipeline")
5. Choose scope:
   - **Read** - View entries only (safer)
   - **Full** - Create, update, delete entries
6. Click **"Create"**
7. **Copy the key immediately** - you won't see it again!

Key format: `tr_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

## Using API Keys

API keys work with:
- Direct HTTP requests to the MCP server
- Claude Code (via stdio proxy)
- Custom MCP clients

### Direct HTTP Requests

Use the `Authorization` header:

```bash
curl -X POST https://trace-mcp.mindjig.com/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tr_live_YOUR_API_KEY_HERE" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_entries",
      "arguments": { "limit": 10 }
    }
  }'
```

### Claude Code (stdio proxy)

Claude Code doesn't support HTTP MCP directly, so use the stdio proxy:

**1. Download the proxy:**

```bash
# macOS/Linux
mkdir -p ~/.trace
curl -sSL https://raw.githubusercontent.com/trace-app/trace/main/scripts/mcp-proxy.js -o ~/.trace/mcp-proxy.js

# Windows (PowerShell)
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.trace"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/trace-app/trace/main/scripts/mcp-proxy.js" -OutFile "$env:USERPROFILE\.trace\mcp-proxy.js"
```

**2. Configure `.mcp.json`:**

```json
{
  "mcpServers": {
    "trace": {
      "command": "node",
      "args": ["~/.trace/mcp-proxy.js"],
      "env": {
        "TRACE_API_KEY": "tr_live_YOUR_API_KEY_HERE"
      }
    }
  }
}
```

**3. Verify connection:**

```bash
claude mcp list
```

You should see:
```
trace: node ~/.trace/mcp-proxy.js - ✓ Connected
```

### Python Example

```python
import requests
import json

API_KEY = "tr_live_YOUR_API_KEY_HERE"
MCP_URL = "https://trace-mcp.mindjig.com/mcp"

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}"
}

# List recent entries
payload = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "list_entries",
        "arguments": {
            "limit": 10,
            "order": "desc"
        }
    }
}

response = requests.post(MCP_URL, headers=headers, json=payload)
result = response.json()

print(json.dumps(result, indent=2))
```

### Node.js Example

```javascript
const https = require('https');

const API_KEY = 'tr_live_YOUR_API_KEY_HERE';
const MCP_URL = 'trace-mcp.mindjig.com';
const MCP_PATH = '/mcp';

function callMCP(method, params) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params
    });

    const options = {
      hostname: MCP_URL,
      port: 443,
      path: MCP_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// List entries
callMCP('tools/call', {
  name: 'list_entries',
  arguments: { limit: 10 }
}).then(result => {
  console.log(JSON.stringify(result, null, 2));
});
```

## Available MCP Methods

### Core Methods

```json
{ "method": "initialize" }
{ "method": "ping" }
{ "method": "tools/list" }
```

### Tool Calls

```json
{
  "method": "tools/call",
  "params": {
    "name": "<tool_name>",
    "arguments": { ... }
  }
}
```

### Available Tools

| Tool | Arguments | Description |
|------|-----------|-------------|
| `list_entries` | `limit`, `stream_id`, `start_date`, `end_date`, `order` | List and filter entries |
| `get_entry` | `entry_id` | Get full entry details |
| `create_entry` | `title`, `content`, `stream_id`, `date`, etc. | Create new entry |
| `update_entry` | `entry_id` + fields to update | Update existing entry |
| `delete_entry` | `entry_id` | Delete an entry |
| `list_streams` | - | List all streams/notebooks |
| `list_attachments` | `entry_id` | List attachments on an entry |

## API Key Scopes

### Read Scope
- `list_entries`
- `get_entry`
- `list_streams`
- `list_attachments`

Safe for exploratory tools and read-only bots.

### Full Scope
All read tools plus:
- `create_entry`
- `update_entry`
- `delete_entry`

Required for automation that modifies data.

## Security Best Practices

### DO:
✅ Store API keys in environment variables, not in code
✅ Use `.env` files and add them to `.gitignore`
✅ Use read-only scope unless you need write access
✅ Rotate keys regularly (every 90 days)
✅ Create separate keys for each integration
✅ Revoke unused keys immediately

### DON'T:
❌ Commit API keys to git repositories
❌ Share API keys in chat/email/Slack
❌ Use the same key for multiple purposes
❌ Give bots/scripts full scope unless required
❌ Log API keys in application logs

### Example: Using Environment Variables

**`.env` file:**
```bash
TRACE_API_KEY=tr_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Python:**
```python
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("TRACE_API_KEY")
```

**Node.js:**
```javascript
require('dotenv').config();
const API_KEY = process.env.TRACE_API_KEY;
```

## Rate Limits

- **100 requests per bucket** (token bucket algorithm)
- **10 requests/second refill rate**
- Rate limits are per API key
- `429 Too Many Requests` response when exceeded
- `Retry-After` header tells you when to retry

## Troubleshooting

### "Invalid or expired token/API key"
- Check the key starts with `tr_live_`
- Verify it hasn't been revoked in Trace Settings
- Make sure you copied the entire key
- Try creating a new key

### "Missing or invalid Authorization header"
- Header format: `Authorization: Bearer tr_live_XXXXX`
- Must include "Bearer " prefix
- Check for typos in the header name

### "Tool requires 'full' scope"
- Your key has read-only scope
- Create a new key with full scope
- Or use a different key that has full access

### "Rate limit exceeded"
- You're making requests too fast
- Wait for the `Retry-After` duration
- Consider batching operations
- Spread requests over time

## Managing API Keys

### View Active Keys
Trace Settings → API Keys

Shows:
- Key name
- Scope (read/full)
- Created date
- Last used date

### Revoke a Key
1. Go to Trace Settings → API Keys
2. Find the key to revoke
3. Click **"Revoke"**
4. Confirm

The key stops working immediately.

### Rotate Keys

Best practice: Rotate every 90 days

1. Create a new key with the same scope
2. Update your applications to use the new key
3. Test that everything works
4. Revoke the old key

## Support

- 📧 Email: support@trace.app
- 💬 Discord: [discord.gg/trace](https://discord.gg/trace)
- 🐛 Report bugs: [github.com/trace-app/trace/issues](https://github.com/trace-app/trace/issues)
- 📖 API Docs: [docs.trace.app/api](https://docs.trace.app/api)

---

**Last updated:** 2026-02-12
**MCP Server Version:** 1.0.0
**Server URL:** `https://trace-mcp.mindjig.com/mcp`
