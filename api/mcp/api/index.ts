// Vercel Edge Function: MCP (Model Context Protocol) Server
// Handles MCP protocol over HTTP + SSE transport
// Provides AI agents with access to Trace app data via standardized tools

// Vercel Edge Runtime configuration
export const config = {
  runtime: 'edge',
};
import { validateApiKey, extractBearerToken } from "./auth";
import {
  sessionManager,
  createSSEHeaders,
} from "./sse";
import {
  type McpRequest,
  type McpResponse,
  type McpCapabilities,
  type AuthResult,
  McpErrorCodes,
  createMcpResponse,
  createMcpError,
  createTextContent,
  createImageContent,
} from "./types";
import { dispatchTool, getToolDefinitions } from "./tools/mod";
import {
  getProtectedResourceMetadata,
  getAuthorizationServerMetadata,
  handleAuthorize,
  handleLogin,
  handleCallback,
  handleGoogleCallback,
  handleToken,
  handleRegister,
  validateOAuthToken,
} from "./oauth";

// CORS headers for MCP clients
// Note: MCP clients (Claude Desktop, etc.) are typically desktop apps that don't
// use browser CORS. However, we restrict the policy as defense-in-depth.
// API key authentication is the primary security boundary.
const ALLOWED_ORIGINS = [
  "https://claude.ai",
  "https://www.anthropic.com",
  "http://localhost:3000",  // Local development
  "http://localhost:5173",  // Vite dev server
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  // For MCP desktop clients (no Origin header), allow the request
  // For browser requests, check against allowlist
  const allowedOrigin = !origin || ALLOWED_ORIGINS.includes(origin)
    ? (origin || "*")
    : ALLOWED_ORIGINS[0]; // Default to first allowed origin

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, MCP-Protocol-Version, Mcp-Session-Id",
    "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
  };
}

// Default CORS for responses without origin context
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, MCP-Protocol-Version, Mcp-Session-Id",
};

// ============================================================================
// Rate Limiting
// Simple token bucket rate limiter (per API key)
//
// ⚠️ LIMITATION: In-memory storage does NOT persist across Edge Function
// invocations on Vercel. Each request may hit a different instance.
// This provides basic protection within a single instance's lifetime only.
// For production at scale, use Redis/Upstash for distributed rate limiting.
// ============================================================================

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const RATE_LIMIT = {
  MAX_TOKENS: 100,        // Max requests in bucket
  REFILL_RATE: 10,        // Tokens added per second
  REFILL_INTERVAL: 1000,  // Refill check interval (ms)
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function checkRateLimit(keyId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let bucket = rateLimitBuckets.get(keyId);

  if (!bucket) {
    // New bucket with full tokens
    bucket = { tokens: RATE_LIMIT.MAX_TOKENS, lastRefill: now };
    rateLimitBuckets.set(keyId, bucket);
  }

  // Refill tokens based on time elapsed
  const elapsed = now - bucket.lastRefill;
  const refillTokens = Math.floor(elapsed / RATE_LIMIT.REFILL_INTERVAL) * RATE_LIMIT.REFILL_RATE;
  if (refillTokens > 0) {
    bucket.tokens = Math.min(RATE_LIMIT.MAX_TOKENS, bucket.tokens + refillTokens);
    bucket.lastRefill = now;
  }

  // Check if we have tokens available
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return { allowed: true };
  }

  // Calculate when they can retry (when 1 token will be available)
  const retryAfter = Math.ceil(RATE_LIMIT.REFILL_INTERVAL / 1000);
  return { allowed: false, retryAfter };
}

// Note: Periodic cleanup not needed - Edge Functions are short-lived and
// in-memory state doesn't persist across invocations anyway.

// MCP Server Info
// Note: protocolVersion must match what Claude.ai sends (2025-11-25)
const SERVER_INFO: McpCapabilities = {
  protocolVersion: "2024-11-05",
  serverInfo: {
    name: "trace-mcp-server",
    version: "1.0.0",
  },
  capabilities: {
    tools: {
      listChanged: false,
    },
  },
};

// Available MCP Tools - loaded dynamically from tool implementations
const TOOLS = getToolDefinitions();

/**
 * Handle MCP JSON-RPC request
 */
async function handleMcpRequest(
  request: McpRequest,
  auth: AuthResult
): Promise<McpResponse> {
  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      console.log("[MCP] Sending initialize response:", JSON.stringify(SERVER_INFO));
      return createMcpResponse(id, SERVER_INFO);

    case "initialized":
    case "notifications/initialized":
      // Client acknowledgment - this is a notification, no response expected
      console.log("[MCP] Received initialized notification");
      // Return empty object to signal this was handled (will be converted to 204 for notifications)
      return createMcpResponse(id ?? 0, { _notification: true });

    case "ping":
      return createMcpResponse(id, {});

    case "tools/list":
      console.log("[MCP] tools/list requested, returning", TOOLS.length, "tools");
      return createMcpResponse(id, { tools: TOOLS });

    case "tools/call":
      return await handleToolCall(id, params as { name: string; arguments?: Record<string, unknown> }, auth);

    case "resources/list":
      // No resources implemented yet
      return createMcpResponse(id, { resources: [] });

    case "resources/read":
      return createMcpError(id, McpErrorCodes.METHOD_NOT_FOUND, "Resources not implemented");

    case "prompts/list":
      // No prompts implemented yet
      return createMcpResponse(id, { prompts: [] });

    case "prompts/get":
      return createMcpError(id, McpErrorCodes.METHOD_NOT_FOUND, "Prompts not implemented");

    default:
      return createMcpError(id, McpErrorCodes.METHOD_NOT_FOUND, `Unknown method: ${method}`);
  }
}

/**
 * Handle tool calls via the tool dispatcher
 */
async function handleToolCall(
  id: string | number,
  params: { name: string; arguments?: Record<string, unknown> },
  auth: AuthResult
): Promise<McpResponse> {
  const { name, arguments: args = {} } = params;

  // Dispatch to the tool handler
  const result = await dispatchTool(name, args, auth.userId, auth.scope, auth.keyName);

  if (result.error) {
    // Check if it's a scope error
    if (result.error.includes("requires 'full' scope")) {
      return createMcpError(id, McpErrorCodes.FORBIDDEN, result.error);
    }
    // Check if it's an unknown tool
    if (result.error.includes("Unknown tool")) {
      return createMcpError(id, McpErrorCodes.INVALID_PARAMS, result.error);
    }
    // General error
    return createMcpResponse(id, {
      content: [createTextContent(`Error: ${result.error}`)],
      isError: true,
    });
  }

  // Check if this is an image response (from get_attachment_data)
  const res = result.result as Record<string, unknown>;
  if (res && res._type === "image" && typeof res.data === "string" && typeof res.mime_type === "string") {
    // Return image content block that Claude can view directly
    const { data, mime_type, ...metadata } = res;
    return createMcpResponse(id, {
      content: [
        createImageContent(data as string, mime_type as string),
        createTextContent(`Image metadata: ${JSON.stringify(metadata, null, 2)}`),
      ],
    });
  }

  // Return successful result as JSON in text content for AI consumption
  return createMcpResponse(id, {
    content: [createTextContent(JSON.stringify(result.result, null, 2))],
  });
}

/**
 * MCP Request or Notification
 * Notifications are like requests but have no id and expect no response
 */
interface McpRequestOrNotification {
  jsonrpc: "2.0";
  id?: string | number; // Optional for notifications
  method: string;
  params?: Record<string, unknown>;
}

/**
 * Parse and validate MCP request or notification body
 */
function parseMcpRequest(body: unknown): McpRequestOrNotification | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const req = body as Record<string, unknown>;

  if (req.jsonrpc !== "2.0") {
    return null;
  }

  if (typeof req.method !== "string") {
    return null;
  }

  // Note: id is optional - notifications don't have an id
  return {
    jsonrpc: "2.0",
    id: req.id as string | number | undefined,
    method: req.method,
    params: req.params as Record<string, unknown> | undefined,
  };
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname;
  const origin = req.headers.get("Origin");
  const responseCors = getCorsHeaders(origin);

  // Log every incoming request
  console.log(`[MCP] ${req.method} ${path}`, {
    origin,
    userAgent: req.headers.get("User-Agent"),
    hasAuth: !!req.headers.get("Authorization"),
    timestamp: new Date().toISOString(),
  });

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log(`[MCP] CORS preflight for ${path} from ${origin}`);
    return new Response(null, { status: 204, headers: responseCors });
  }

  // Health check endpoint
  if (path === "/mcp/health" && req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", server: SERVER_INFO.serverInfo }),
      {
        status: 200,
        headers: { ...responseCors, "Content-Type": "application/json" },
      }
    );
  }

  // OAuth 2.1 Discovery Endpoints (RFC 9728, RFC 8414)
  // Serve at both /mcp/.well-known/ and /.well-known/ for compatibility
  const isProtectedResourceEndpoint =
    path === "/mcp/.well-known/oauth-protected-resource" ||
    path === "/.well-known/oauth-protected-resource";

  const isAuthServerEndpoint =
    path === "/mcp/.well-known/oauth-authorization-server" ||
    path === "/.well-known/oauth-authorization-server";

  // Support both GET and HEAD for discovery endpoints (clients may probe with HEAD first)
  if (isProtectedResourceEndpoint && (req.method === "GET" || req.method === "HEAD")) {
    console.log(`[OAuth] Protected resource metadata ${req.method} from ${origin}`);
    const body = req.method === "GET" ? JSON.stringify(getProtectedResourceMetadata()) : null;
    return new Response(body, {
      status: 200,
      headers: { ...responseCors, "Content-Type": "application/json" },
    });
  }

  if (isAuthServerEndpoint && (req.method === "GET" || req.method === "HEAD")) {
    console.log(`[OAuth] Authorization server metadata ${req.method} from ${origin}`);
    const body = req.method === "GET" ? JSON.stringify(getAuthorizationServerMetadata()) : null;
    return new Response(body, {
      status: 200,
      headers: { ...responseCors, "Content-Type": "application/json" },
    });
  }

  // OAuth 2.1 Flow Endpoints (match both /oauth/* and /mcp/oauth/*)
  // Support HEAD for authorize endpoint - clients probe endpoints before making requests
  if ((path === "/oauth/authorize" || path === "/mcp/oauth/authorize") && (req.method === "GET" || req.method === "HEAD")) {
    console.log(`[OAuth] Authorization ${req.method} request`, {
      clientId: new URL(req.url).searchParams.get("client_id"),
      scope: new URL(req.url).searchParams.get("scope"),
      redirectUri: new URL(req.url).searchParams.get("redirect_uri"),
    });
    if (req.method === "HEAD") {
      // HEAD request - just confirm the endpoint exists
      return new Response(null, {
        status: 200,
        headers: { ...responseCors, "Content-Type": "text/html" },
      });
    }
    return await handleAuthorize(req);
  }

  if ((path === "/oauth/login" || path === "/mcp/oauth/login") && (req.method === "GET" || req.method === "POST")) {
    console.log(`[OAuth] Login ${req.method} request`);
    return await handleLogin(req);
  }

  if ((path === "/oauth/callback" || path === "/mcp/oauth/callback") && req.method === "GET") {
    console.log(`[OAuth] Callback request`, {
      hasCode: !!new URL(req.url).searchParams.get("code"),
      hasState: !!new URL(req.url).searchParams.get("state"),
    });
    return await handleCallback(req);
  }

  if ((path === "/oauth/google-callback" || path === "/mcp/oauth/google-callback") && req.method === "GET") {
    console.log(`[OAuth] Google callback request`, {
      hasToken: !!new URL(req.url).searchParams.get("access_token"),
      hasState: !!new URL(req.url).searchParams.get("state"),
    });
    return await handleGoogleCallback(req);
  }

  if ((path === "/oauth/token" || path === "/mcp/oauth/token") && (req.method === "POST" || req.method === "HEAD")) {
    if (req.method === "HEAD") {
      console.log(`[OAuth] Token endpoint HEAD probe`);
      return new Response(null, {
        status: 200,
        headers: { ...responseCors, "Content-Type": "application/json" },
      });
    }
    console.log(`[OAuth] Token exchange request`);
    return await handleToken(req);
  }

  if ((path === "/oauth/register" || path === "/mcp/oauth/register") && (req.method === "POST" || req.method === "HEAD")) {
    if (req.method === "HEAD") {
      console.log(`[OAuth] Register endpoint HEAD probe`);
      return new Response(null, {
        status: 200,
        headers: { ...responseCors, "Content-Type": "application/json" },
      });
    }
    console.log(`[OAuth] Dynamic client registration request from ${origin}`);
    return await handleRegister(req);
  }

  // Route: GET / or /mcp - Server discovery for HTTP transport (no auth required)
  // Route: GET/HEAD / or /mcp - Server discovery for HTTP transport (no auth required)
  // Claude Code health check hits this endpoint without auth headers
  // Support HEAD for clients that probe endpoints before making requests
  if ((path === "/" || path === "/mcp" || path === "/mcp/") && (req.method === "GET" || req.method === "HEAD")) {
    console.log(`[MCP] Discovery endpoint ${req.method} - returning server info without auth`);
    const body = req.method === "GET" ? JSON.stringify({ jsonrpc: "2.0", result: SERVER_INFO }) : null;
    return new Response(body, {
      status: 200,
      headers: { ...responseCors, "Content-Type": "application/json" },
    });
  }

  console.log(`[MCP] Discovery route NOT matched - path: "${path}", method: ${req.method}`);

  // Extract and validate authentication (supports both OAuth tokens and API keys)
  const authHeader = req.headers.get("Authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    console.log(`[Auth] Missing Authorization header for ${path}`);
    return new Response(
      JSON.stringify({
        error: "Missing or invalid Authorization header",
        hint: "Use: Authorization: Bearer <token> (OAuth token or API key tr_live_...)",
      }),
      {
        status: 401,
        headers: {
          ...responseCors,
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer realm="https://trace-mcp.mindjig.com/.well-known/oauth-protected-resource"`,
        },
      }
    );
  }

  let auth: AuthResult | null = null;

  // Try OAuth token first
  if (token.startsWith("mcp_")) {
    console.log(`[Auth] Validating OAuth token for ${path}`);
    const oauthResult = await validateOAuthToken(token);
    if (oauthResult) {
      auth = {
        userId: oauthResult.userId,
        scope: oauthResult.scope as "read" | "full",
        keyId: "oauth",
        keyName: "OAuth Token",
      };
      console.log(`[Auth] OAuth token valid - userId: ${auth.userId}, scope: ${auth.scope}`);
    } else {
      console.log(`[Auth] OAuth token validation failed`);
    }
  } else {
    // Fall back to API key validation
    console.log(`[Auth] Validating API key for ${path}`);
    auth = await validateApiKey(token);
    if (auth) {
      console.log(`[Auth] API key valid - userId: ${auth.userId}, scope: ${auth.scope}, key: ${auth.keyName}`);
    } else {
      console.log(`[Auth] API key validation failed`);
    }
  }

  if (!auth) {
    console.log(`[Auth] Authentication failed for ${path}`);
    return new Response(
      JSON.stringify({ error: "Invalid or expired token/API key" }),
      {
        status: 401,
        headers: {
          ...responseCors,
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer realm="https://trace-mcp.mindjig.com/.well-known/oauth-protected-resource"`,
        },
      }
    );
  }

  // Check rate limit (per API key)
  const rateLimit = checkRateLimit(auth.keyId);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retry_after_seconds: rateLimit.retryAfter,
      }),
      {
        status: 429,
        headers: {
          ...responseCors,
          "Content-Type": "application/json",
          "Retry-After": String(rateLimit.retryAfter || 1),
        },
      }
    );
  }

  // Route: GET /mcp/sse - SSE stream for session
  if (path === "/mcp/sse" && req.method === "GET") {
    const sessionId = url.searchParams.get("session_id");

    if (sessionId) {
      // Resume existing session
      const session = sessionManager.getSession(sessionId);
      if (!session || session.userId !== auth.userId) {
        return new Response(
          JSON.stringify({ error: "Session not found or unauthorized" }),
          {
            status: 404,
            headers: { ...responseCors, "Content-Type": "application/json" },
          }
        );
      }

      const sseResponse = sessionManager.createSessionStream(sessionId, corsHeaders);
      if (sseResponse) {
        return sseResponse;
      }
    }

    // Create new session
    const session = sessionManager.createSession(auth.userId);
    const headers = createSSEHeaders(corsHeaders);

    // Send session endpoint as first message
    // Force HTTPS - url.protocol may be HTTP when behind a proxy
    const baseUrl = `https://${url.host}`;
    const endpoint = `${baseUrl}/mcp?session_id=${session.id}`;

    return new Response(
      `event: endpoint\ndata: ${JSON.stringify(endpoint)}\n\n`,
      {
        status: 200,
        headers,
      }
    );
  }

  // Route: POST / or /mcp - Handle MCP JSON-RPC requests
  if ((path === "/" || path === "/mcp" || path === "/mcp/") && req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch (e) {
      console.log(`[MCP] JSON parse error:`, e);
      return new Response(
        JSON.stringify(createMcpError(0, McpErrorCodes.PARSE_ERROR, "Invalid JSON")),
        {
          status: 400,
          headers: { ...responseCors, "Content-Type": "application/json" },
        }
      );
    }

    const mcpRequest = parseMcpRequest(body);
    if (!mcpRequest) {
      console.log(`[MCP] Invalid request format:`, body);
      return new Response(
        JSON.stringify(createMcpError(0, McpErrorCodes.INVALID_REQUEST, "Invalid MCP request format")),
        {
          status: 400,
          headers: { ...responseCors, "Content-Type": "application/json" },
        }
      );
    }

    const isNotification = mcpRequest.id === undefined;
    console.log(`[MCP] ${isNotification ? "Notification" : "Request"}: ${mcpRequest.method}`, { id: mcpRequest.id, params: mcpRequest.params });

    // Handle notifications (no id) - they don't expect a response
    if (isNotification) {
      console.log(`[MCP] Handling notification: ${mcpRequest.method}`);
      // For notifications, just acknowledge without a body
      return new Response(null, {
        status: 202,
        headers: { ...responseCors },
      });
    }

    // Check if response should go to SSE session
    const sessionId = url.searchParams.get("session_id");
    const response = await handleMcpRequest(mcpRequest as McpRequest, auth);

    // Log full response for debugging key methods
    if (mcpRequest.method === "initialize" || mcpRequest.method === "tools/list") {
      console.log(`[MCP] Full Response for ${mcpRequest.method}:`, JSON.stringify(response));
    } else {
      console.log(`[MCP] Response: ${mcpRequest.method}`, { id: mcpRequest.id, hasError: !!response.error });
    }

    if (sessionId) {
      // Queue response to SSE session
      sessionManager.queueMessage(sessionId, response);
      return new Response(
        JSON.stringify({ status: "queued", session_id: sessionId }),
        {
          status: 202,
          headers: { ...responseCors, "Content-Type": "application/json" },
        }
      );
    }

    // Direct JSON response
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...responseCors, "Content-Type": "application/json" },
    });
  }

  // 404 for unknown routes
  return new Response(
    JSON.stringify({
      error: "Not found",
      routes: {
        "POST /mcp": "MCP JSON-RPC endpoint",
        "GET /mcp/sse": "SSE stream endpoint",
        "GET /mcp/health": "Health check",
        "GET /mcp/.well-known/oauth-protected-resource": "OAuth resource metadata",
        "GET /mcp/.well-known/oauth-authorization-server": "OAuth server metadata",
        "GET /mcp/oauth/authorize": "OAuth authorization endpoint",
        "GET/POST /mcp/oauth/login": "OAuth login page",
        "GET /mcp/oauth/callback": "OAuth callback endpoint",
        "GET /mcp/oauth/google-callback": "OAuth Google callback endpoint",
        "POST /mcp/oauth/token": "OAuth token exchange",
        "POST /mcp/oauth/register": "OAuth dynamic client registration",
      },
    }),
    {
      status: 404,
      headers: { ...responseCors, "Content-Type": "application/json" },
    }
  );
}
