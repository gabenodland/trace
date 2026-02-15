# Deploy MCP Server

Deploy the Trace MCP server to Vercel production.

## Instructions

### 1. Verify .vercel project link exists

Check if `api/mcp/.vercel/project.json` exists. If not, create it:

```bash
mkdir -p api/mcp/.vercel
cat > api/mcp/.vercel/project.json << 'EOF'
{ "orgId": "team_0OgQw0913bFe7FuW09UKZhZa", "projectId": "prj_KVxeJI4AalU5X8ReogAdQim0WhuK" }
EOF
```

### 2. Check environment variables

Verify these are set in Vercel dashboard (Settings → Environment Variables):
- `SUPABASE_URL` = `https://lsszorssvkavegobmqic.supabase.co`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### 3. Deploy

```bash
cd api/mcp && npx vercel --prod --yes
```

### 4. Verify deployment

```bash
curl https://trace-mcp.mindjig.com/mcp
curl https://trace-mcp.mindjig.com/.well-known/oauth-protected-resource
```

### 5. Report

Tell the user the deployment URL and status.
