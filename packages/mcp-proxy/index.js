#!/usr/bin/env node
/**
 * Trace MCP Proxy
 *
 * This proxy bridges Claude Code's stdio MCP transport to the Trace MCP server.
 *
 * Usage in .mcp.json:
 * {
 *   "mcpServers": {
 *     "trace": {
 *       "command": "npx",
 *       "args": ["-y", "@trace-app/mcp-proxy"],
 *       "env": { "TRACE_API_KEY": "your_api_key_here" }
 *     }
 *   }
 * }
 */

const https = require('https');
const readline = require('readline');

const MCP_URL = 'trace-mcp.mindjig.com';
const MCP_PATH = '/mcp';

// Get API key from environment variable
const API_KEY = process.env.TRACE_API_KEY;

if (!API_KEY) {
  console.error(JSON.stringify({
    jsonrpc: '2.0',
    id: null,
    error: {
      code: -32603,
      message: 'TRACE_API_KEY environment variable is required. Get your API key from Trace app Settings > API Keys.'
    }
  }));
  process.exit(1);
}

// Set up readline to read JSON-RPC messages from stdin
const rl = readline.createInterface({
  input: process.stdin,
  terminal: false
});

// Process each line as a JSON-RPC request
rl.on('line', async (line) => {
  let requestId = null;
  try {
    const request = JSON.parse(line);
    requestId = request.id ?? null; // Preserve request ID for error responses
    const response = await forwardRequest(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      id: requestId, // Include original request ID for client correlation
      error: { code: -32603, message: error.message }
    }));
  }
});

/**
 * Forward a JSON-RPC request to the Trace MCP server
 */
function forwardRequest(request) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(request);

    const options = {
      hostname: MCP_URL,
      port: 443,
      path: MCP_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Invalid response from server: ${body.substring(0, 100)}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Network error: ${e.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(data);
    req.end();
  });
}

// Keep process alive
process.stdin.resume();
