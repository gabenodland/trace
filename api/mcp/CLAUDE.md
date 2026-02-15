# MCP Server

Claude.ai MCP server deployed as Vercel Edge Function with OAuth 2.1.

## Architecture

```
api/mcp/
├── api/
│   ├── index.ts           # Main handler — routes all requests
│   ├── auth.ts            # API key validation
│   ├── oauth.ts           # OAuth 2.1 implementation
│   ├── sse.ts             # Server-sent events
│   ├── types.ts           # MCP types
│   └── tools/             # MCP tool implementations
│       ├── mod.ts         # Tool registry and dispatcher
│       ├── entries.ts     # Entry CRUD
│       ├── streams.ts     # Stream operations
│       └── attachments.ts # Attachment URL generation
├── vercel.json            # Routing
└── package.json           # Dependencies
```

## Deployment

Use `/deploy-mcp` slash command for the full checklist.

Quick deploy:
```bash
cd api/mcp && npx vercel --prod --yes
```

If "missing_scope" error — `.vercel/` is gitignored. Recreate:
```bash
mkdir -p api/mcp/.vercel
cat > api/mcp/.vercel/project.json << 'EOF'
{ "orgId": "team_0OgQw0913bFe7FuW09UKZhZa", "projectId": "prj_KVxeJI4AalU5X8ReogAdQim0WhuK" }
EOF
```

## Environment Variables (Vercel Dashboard)

| Variable | Source |
|----------|--------|
| `SUPABASE_URL` | `https://lsszorssvkavegobmqic.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role/secret |

## URLs

- Production: https://trace-mcp.mindjig.com
- Vercel default: https://trace-mcp.vercel.app

## OAuth 2.1 Flow

1. Client discovers OAuth via `/.well-known/oauth-protected-resource`
2. Dynamic registration via `/oauth/register` (RFC 7591)
3. Auth via `/oauth/authorize` with PKCE
4. User logs in via Supabase at `/oauth/login`
5. Callback returns auth code
6. Code → token exchange at `/oauth/token`
7. Client uses token for MCP requests

## Testing

```bash
curl https://trace-mcp.mindjig.com/mcp
curl https://trace-mcp.mindjig.com/.well-known/oauth-protected-resource
curl https://trace-mcp.mindjig.com/.well-known/oauth-authorization-server
```

## Custom Domain

`trace-mcp.mindjig.com` via:
- Vercel: Project → Settings → Domains
- Porkbun DNS: A record → `76.76.21.21`
