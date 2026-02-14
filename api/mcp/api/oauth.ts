// OAuth 2.1 Implementation for MCP Server
// Implements RFC 8414 (Authorization Server Metadata), RFC 9728 (Protected Resource Metadata),
// RFC 8707 (Resource Indicators), and PKCE (RFC 7636)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://lsszorssvkavegobmqic.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// OAuth configuration - use custom domain
const MCP_SERVER_BASE_URL = process.env.MCP_BASE_URL || "https://trace-mcp.mindjig.com";
const OAUTH_ISSUER = MCP_SERVER_BASE_URL;

// In-memory storage for OAuth sessions (would use Redis/DB in production)
interface OAuthSession {
  userId: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  scope: string;
  expiresAt: number;
  resource?: string; // RFC 8707 Resource Indicators
}

interface AccessToken {
  userId: string;
  scope: string;
  expiresAt: number;
  resource?: string; // RFC 8707 Resource Indicators
}

// Note: Auth codes and access tokens are stored in Supabase for persistence across serverless invocations

/**
 * RFC 9728: Protected Resource Metadata
 * Returns metadata about this protected resource and its authorization server
 */
export function getProtectedResourceMetadata() {
  return {
    resource: OAUTH_ISSUER,
    authorization_servers: [OAUTH_ISSUER],
    bearer_methods_supported: ["header"],
    resource_signing_alg_values_supported: ["none"],
    resource_documentation: "https://github.com/trace-app/trace",
  };
}

/**
 * RFC 8414: Authorization Server Metadata Discovery
 * Returns OAuth 2.0 authorization server metadata
 */
export function getAuthorizationServerMetadata() {
  return {
    issuer: OAUTH_ISSUER,
    authorization_endpoint: `${OAUTH_ISSUER}/oauth/authorize`,
    token_endpoint: `${OAUTH_ISSUER}/oauth/token`,
    registration_endpoint: `${OAUTH_ISSUER}/oauth/register`,
    // Support both OIDC scopes (for claude.ai compatibility) and our custom scopes
    scopes_supported: ["openid", "offline_access", "read", "full"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    service_documentation: "https://github.com/trace-app/trace",
  };
}

/**
 * Generate a random code (authorization code or token)
 */
function generateCode(length: number = 32): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

/**
 * Generate a success page that redirects to OAuth client and allows closing the tab
 */
function getSuccessPageHTML(redirectUrl: string): Response {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authentication Complete</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .checkmark {
      width: 60px;
      height: 60px;
      margin: 0 auto 20px;
      background: #4ade80;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .checkmark svg {
      width: 30px;
      height: 30px;
      fill: white;
    }
    h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
    p { color: #666; font-size: 14px; margin-bottom: 10px; }
    .close-hint {
      margin-top: 20px;
      padding: 12px;
      background: #f0f4ff;
      border-radius: 6px;
      font-size: 13px;
      color: #555;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">
      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
    </div>
    <h1>Authentication Complete!</h1>
    <p>You've successfully connected to Trace.</p>
    <p id="status">Redirecting back to Claude...</p>
    <div class="close-hint">
      You can safely close this tab if it doesn't close automatically.
    </div>
  </div>
  <script>
    // Try to redirect to complete the OAuth flow
    setTimeout(function() {
      window.location.href = ${JSON.stringify(redirectUrl)};
    }, 500);

    // Update status and try to close the window after redirect
    setTimeout(function() {
      document.getElementById('status').textContent = 'Closing this tab in a few seconds...';
    }, 2000);

    // Aggressively try to close the window after 5 seconds
    setTimeout(function() {
      document.getElementById('status').textContent = 'You can close this tab now.';
      // Try multiple close methods
      try { window.close(); } catch(e) {}
      try { self.close(); } catch(e) {}
      try { window.open('', '_self').close(); } catch(e) {}
    }, 5000);
  </script>
</body>
</html>
  `;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

/**
 * Hash a code/token using SHA-256 for secure storage
 */
async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Store an authorization code in Supabase
 */
async function storeAuthCode(
  code: string,
  userId: string,
  codeChallenge: string,
  codeChallengeMethod: string,
  redirectUri: string,
  scope: string,
  resource: string | null
): Promise<boolean> {
  const codeHash = await hashCode(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { error } = await supabase.rpc("create_mcp_oauth_code", {
    p_code_hash: codeHash,
    p_user_id: userId,
    p_code_challenge: codeChallenge,
    p_code_challenge_method: codeChallengeMethod,
    p_redirect_uri: redirectUri,
    p_scope: scope,
    p_resource: resource,
    p_expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error("[OAuth] Failed to store auth code:", error);
    return false;
  }

  return true;
}

/**
 * Retrieve and consume an authorization code from Supabase (single use)
 */
async function retrieveAuthCode(code: string): Promise<OAuthSession | null> {
  const codeHash = await hashCode(code);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.rpc("verify_mcp_oauth_code", {
    p_code_hash: codeHash,
  });

  if (error) {
    console.error("[OAuth] Failed to verify auth code:", error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log("[OAuth] Auth code not found or expired");
    return null;
  }

  const row = data[0];
  return {
    userId: row.user_id,
    codeChallenge: row.code_challenge,
    codeChallengeMethod: row.code_challenge_method,
    redirectUri: row.redirect_uri,
    scope: row.scope,
    resource: row.resource || undefined,
    expiresAt: 0, // Already verified in the RPC
  };
}

/**
 * Verify PKCE code challenge
 */
async function verifyPKCE(codeVerifier: string, codeChallenge: string, method: string): Promise<boolean> {
  if (method !== "S256") {
    return false;
  }

  // Hash the code_verifier using SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Base64url encode the hash
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray));
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return base64url === codeChallenge;
}

/**
 * Handle OAuth authorization request (GET /oauth/authorize)
 * This endpoint initiates the OAuth flow by redirecting to Supabase Auth
 */
export async function handleAuthorize(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;

  // Extract OAuth parameters
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state");
  const scope = params.get("scope") || "read";
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const resource = params.get("resource"); // RFC 8707 - Resource Indicators

  // Validate required parameters
  if (!clientId || !redirectUri || !codeChallenge || codeChallengeMethod !== "S256") {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "Missing or invalid required parameters (client_id, redirect_uri, code_challenge with S256 method required)",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Parse and normalize scope
  // Accept OIDC scopes (openid, offline_access) for claude.ai compatibility
  // Map to our internal scope: 'full' if requested, otherwise 'read'
  const scopeList = scope.split(/[\s+]+/); // Split on space or +
  const hasFullScope = scopeList.includes("full");
  const normalizedScope = hasFullScope ? "full" : "read";
  console.log(`[OAuth] Scope requested: "${scope}" -> normalized to "${normalizedScope}"`);
  // Note: We accept any scope and map it. OIDC scopes like 'openid' and 'offline_access'
  // are accepted for compatibility but don't change our behavior.

  // Validate resource parameter (RFC 8707) - optional but recommended
  // If provided, it should match our MCP server URL
  if (resource && !resource.startsWith(OAUTH_ISSUER)) {
    return new Response(
      JSON.stringify({
        error: "invalid_target",
        error_description: `Resource parameter must match this server: ${OAUTH_ISSUER}`,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Store the OAuth session temporarily (keyed by state for later retrieval)
  const sessionKey = state || generateCode(16);

  // Create a login page that will handle the authentication
  // Store pending auth in sessionKey for retrieval after login
  const resourceParam = resource ? `&resource=${encodeURIComponent(resource)}` : "";
  const loginPageUrl = `${OAUTH_ISSUER}/oauth/login?state=${sessionKey}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${normalizedScope}&code_challenge=${codeChallenge}&code_challenge_method=${codeChallengeMethod}${resourceParam}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: loginPageUrl,
    },
  });
}

/**
 * Handle login page (GET /oauth/login)
 * Shows a login form for users to authenticate with their Trace account
 */
export async function handleLogin(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;

  const state = params.get("state");
  const redirectUri = params.get("redirect_uri");
  const scope = params.get("scope");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const resource = params.get("resource");

  // Handle POST - login form submission
  if (req.method === "POST") {
    let formData: Record<string, string>;
    try {
      const body = await req.text();
      formData = Object.fromEntries(new URLSearchParams(body));
    } catch {
      return new Response("Invalid form data", { status: 400 });
    }

    const email = formData.email;
    const password = formData.password;

    if (!email || !password) {
      return getLoginPageHTML(state, redirectUri, scope, codeChallenge, codeChallengeMethod, "Email and password are required");
    }

    // Authenticate with Supabase using anon key (for user login)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      return getLoginPageHTML(state, redirectUri, scope, codeChallenge, codeChallengeMethod, "Invalid email or password");
    }

    // Generate authorization code
    const authCode = generateCode(32);

    // Store authorization code in Supabase (persistent across serverless invocations)
    const stored = await storeAuthCode(
      authCode,
      data.user.id,
      codeChallenge!,
      codeChallengeMethod!,
      redirectUri!,
      scope || "read",
      resource || null
    );

    if (!stored) {
      return getLoginPageHTML(state, redirectUri, scope, codeChallenge, codeChallengeMethod, "Failed to create authorization. Please try again.", resource);
    }

    // Build redirect URL with authorization code
    const redirectUrl = new URL(redirectUri!);
    redirectUrl.searchParams.set("code", authCode);
    if (state) {
      redirectUrl.searchParams.set("state", state);
    }

    // Show success page that redirects and tells user they can close the tab
    return getSuccessPageHTML(redirectUrl.toString());
  }

  // GET - show login form
  return getLoginPageHTML(state, redirectUri, scope, codeChallenge, codeChallengeMethod, null, resource);
}

/**
 * Generate login page HTML
 */
function getLoginPageHTML(
  state: string | null,
  redirectUri: string | null,
  scope: string | null,
  codeChallenge: string | null,
  codeChallengeMethod: string | null,
  errorMessage: string | null,
  resource: string | null = null
): Response {
  // Build Google OAuth URL via Supabase
  // After Google auth, Supabase will redirect to our /oauth/google-callback with the session
  const googleCallbackParams = new URLSearchParams({
    state: state || "",
    redirect_uri: redirectUri || "",
    scope: scope || "read",
    code_challenge: codeChallenge || "",
    code_challenge_method: codeChallengeMethod || "",
    ...(resource ? { resource } : {}),
  });
  const googleCallbackUrl = `${OAUTH_ISSUER}/oauth/google-callback?${googleCallbackParams.toString()}`;
  const googleAuthUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(googleCallbackUrl)}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trace MCP - Sign In</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 100%;
      padding: 40px;
    }
    .logo {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo h1 {
      font-size: 32px;
      color: #333;
      margin-bottom: 8px;
    }
    .logo p {
      color: #666;
      font-size: 14px;
    }
    .error {
      background: #fee;
      border: 1px solid #fcc;
      color: #c33;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .google-btn {
      width: 100%;
      padding: 12px;
      background: white;
      color: #333;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: background 0.2s, border-color 0.2s;
      text-decoration: none;
      margin-bottom: 20px;
    }
    .google-btn:hover {
      background: #f8f8f8;
      border-color: #ccc;
    }
    .google-btn svg {
      width: 20px;
      height: 20px;
    }
    .divider {
      display: flex;
      align-items: center;
      margin: 20px 0;
      color: #999;
      font-size: 14px;
    }
    .divider::before, .divider::after {
      content: "";
      flex: 1;
      height: 1px;
      background: #ddd;
    }
    .divider::before { margin-right: 15px; }
    .divider::after { margin-left: 15px; }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 6px;
      color: #333;
      font-weight: 500;
      font-size: 14px;
    }
    input[type="email"],
    input[type="password"] {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    input[type="email"]:focus,
    input[type="password"]:focus {
      outline: none;
      border-color: #667eea;
    }
    button[type="submit"] {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    button[type="submit"]:hover {
      transform: translateY(-2px);
    }
    button[type="submit"]:active {
      transform: translateY(0);
    }
    .info {
      margin-top: 20px;
      padding: 12px;
      background: #f0f4ff;
      border-radius: 6px;
      font-size: 13px;
      color: #555;
    }
    .info strong {
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>🔗 Trace MCP</h1>
      <p>Connect your AI assistant to Trace</p>
    </div>

    ${errorMessage ? `<div class="error">${errorMessage}</div>` : ""}

    <a href="${googleAuthUrl}" class="google-btn">
      <svg viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continue with Google
    </a>

    <div class="divider">or sign in with email</div>

    <form method="POST">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required>
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required>
      </div>

      <button type="submit">Sign In with Email</button>

      <input type="hidden" name="state" value="${state || ""}">
      <input type="hidden" name="redirect_uri" value="${redirectUri || ""}">
      <input type="hidden" name="scope" value="${scope || "read"}">
      <input type="hidden" name="code_challenge" value="${codeChallenge || ""}">
      <input type="hidden" name="code_challenge_method" value="${codeChallengeMethod || ""}">
      <input type="hidden" name="resource" value="${resource || ""}">
    </form>

    <div class="info">
      <strong>What's happening?</strong><br>
      Your AI assistant is requesting ${scope === "full" ? "full" : "read-only"} access to your Trace data.
      Sign in with your Trace account to authorize this connection.
    </div>
  </div>
</body>
</html>
  `;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

/**
 * Handle OAuth callback (GET /oauth/callback)
 * This endpoint receives the user after Supabase Auth and issues an authorization code
 */
export async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;

  // Get parameters from our authorize endpoint
  const state = params.get("state");
  const redirectUri = params.get("redirect_uri");
  const scope = params.get("scope") || "read";
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const resource = params.get("resource");

  // Get access token from Supabase Auth (in URL hash or query params)
  const accessToken = params.get("access_token");

  if (!accessToken) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Failed</title></head>
        <body>
          <h1>Authentication Failed</h1>
          <p>No access token received from authentication provider.</p>
        </body>
      </html>
      `,
      {
        status: 400,
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  // Validate the Supabase access token and get user info
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Authentication Failed</title></head>
        <body>
          <h1>Authentication Failed</h1>
          <p>Invalid or expired authentication token.</p>
        </body>
      </html>
      `,
      {
        status: 401,
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  // Generate authorization code
  const authCode = generateCode(32);

  // Store authorization code in Supabase (persistent across serverless invocations)
  const stored = await storeAuthCode(
    authCode,
    user.id,
    codeChallenge!,
    codeChallengeMethod!,
    redirectUri!,
    scope,
    resource || null
  );

  if (!stored) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head><title>Error</title></head>
        <body>
          <h1>Authorization Failed</h1>
          <p>Failed to create authorization code. Please try again.</p>
        </body>
      </html>
      `,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  // Redirect back to the client with the authorization code
  const redirectUrl = new URL(redirectUri!);
  redirectUrl.searchParams.set("code", authCode);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString(),
    },
  });
}

/**
 * Handle token exchange (POST /oauth/token)
 * Exchanges authorization code for access token
 */
export async function handleToken(req: Request): Promise<Response> {
  let body: Record<string, string>;

  try {
    // OAuth token endpoint accepts form-urlencoded
    const contentType = req.headers.get("Content-Type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    } else {
      body = await req.json();
    }
  } catch {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "Invalid request body",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const grantType = body.grant_type;
  const code = body.code;
  const redirectUri = body.redirect_uri;
  const codeVerifier = body.code_verifier;
  const resource = body.resource; // RFC 8707 - Resource Indicators

  // Validate grant type
  if (grantType !== "authorization_code") {
    return new Response(
      JSON.stringify({
        error: "unsupported_grant_type",
        error_description: "Only authorization_code grant type is supported",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Validate required parameters
  if (!code || !redirectUri || !codeVerifier) {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "Missing required parameters (code, redirect_uri, code_verifier)",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Retrieve and validate authorization code from Supabase
  // Note: retrieveAuthCode also deletes the code (single use per OAuth spec)
  const session = await retrieveAuthCode(code);

  if (!session) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid or expired authorization code",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Note: Expiration is already checked by the RPC function

  // Verify redirect URI matches
  if (session.redirectUri !== redirectUri) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Redirect URI mismatch",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Verify resource parameter matches (RFC 8707)
  if (session.resource !== resource) {
    return new Response(
      JSON.stringify({
        error: "invalid_target",
        error_description: "Resource parameter mismatch",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Verify PKCE code verifier
  const pkceValid = await verifyPKCE(codeVerifier, session.codeChallenge, session.codeChallengeMethod);

  if (!pkceValid) {
    // Code was already deleted by retrieveAuthCode
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid code verifier",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Code was already deleted by retrieveAuthCode (single use)

  // Generate access token
  const accessToken = `mcp_${generateCode(48)}`;

  // Hash the token for storage (we store hash, not the actual token)
  const tokenHash = await hashToken(accessToken);

  // Store access token in Supabase (persistent across serverless invocations)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

  const { error: storeError } = await supabase.rpc("create_mcp_oauth_token", {
    p_token_hash: tokenHash,
    p_user_id: session.userId,
    p_scope: session.scope,
    p_resource: session.resource || null,
    p_expires_at: expiresAt.toISOString(),
  });

  if (storeError) {
    console.error("[OAuth/Token] Failed to store token:", storeError);
    return new Response(
      JSON.stringify({
        error: "server_error",
        error_description: "Failed to create access token",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  console.log("[OAuth/Token] Token created for user:", session.userId);

  // Return access token
  return new Response(
    JSON.stringify({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 365 * 24 * 60 * 60, // 1 year in seconds
      scope: session.scope,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

/**
 * Hash a token using SHA-256 for secure storage
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validate an OAuth access token
 * Returns user ID and scope if valid, null otherwise
 * Queries Supabase for persistent token storage
 */
export async function validateOAuthToken(token: string): Promise<{ userId: string; scope: string } | null> {
  if (!token.startsWith("mcp_")) {
    return null;
  }

  // Hash the token to look it up
  const tokenHash = await hashToken(token);

  // Query Supabase for the token
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.rpc("verify_mcp_oauth_token", {
    p_token_hash: tokenHash,
  });

  if (error) {
    console.error("[OAuth] Token verification error:", error);
    return null;
  }

  if (!data || data.length === 0) {
    console.log("[OAuth] Token not found or expired");
    return null;
  }

  const tokenData = data[0];
  console.log("[OAuth] Token valid for user:", tokenData.user_id);

  return {
    userId: tokenData.user_id,
    scope: tokenData.scope,
  };
}

/**
 * Handle Google OAuth callback (GET /oauth/google-callback)
 * Supabase redirects here after Google authentication
 * The access token is in the URL hash fragment, so we need client-side JavaScript to extract it
 */
export async function handleGoogleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const params = url.searchParams;

  // Get OAuth flow parameters that we passed through
  const state = params.get("state");
  const redirectUri = params.get("redirect_uri");
  const scope = params.get("scope") || "read";
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const resource = params.get("resource");

  // Check if we have an access_token in query params (server-side redirect)
  const accessToken = params.get("access_token");

  if (accessToken) {
    // Access token received directly - validate and complete the flow
    return completeGoogleAuth(accessToken, state, redirectUri, scope, codeChallenge, codeChallengeMethod, resource);
  }

  // Supabase returns tokens in hash fragment, not query params
  // We need client-side JavaScript to extract and POST them to us
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Completing Sign In...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 4px solid #f3f3f3;
      border-top: 4px solid #667eea;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
    p { color: #666; font-size: 14px; }
    .error { color: #c33; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner" id="spinner"></div>
    <h1>Completing Sign In</h1>
    <p id="status">Processing your authentication...</p>
    <div class="error" id="error" style="display:none;"></div>
  </div>
  <script>
    (function() {
      // Parse hash fragment for tokens
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');

      if (!accessToken) {
        // Check for error
        const error = params.get('error');
        const errorDesc = params.get('error_description');
        if (error) {
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('status').textContent = 'Authentication failed';
          document.getElementById('error').textContent = errorDesc || error;
          document.getElementById('error').style.display = 'block';
        } else {
          document.getElementById('spinner').style.display = 'none';
          document.getElementById('status').textContent = 'No authentication token received';
          document.getElementById('error').textContent = 'Please try signing in again.';
          document.getElementById('error').style.display = 'block';
        }
        return;
      }

      // Build redirect URL with token as query param (so server can process)
      const currentUrl = new URL(window.location.href);
      // Preserve the OAuth flow params
      currentUrl.searchParams.set('access_token', accessToken);
      // Clear the hash
      currentUrl.hash = '';

      // Redirect to same endpoint but with token in query string
      window.location.replace(currentUrl.toString());
    })();
  </script>
</body>
</html>
  `;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

/**
 * Complete Google authentication after extracting the access token
 */
async function completeGoogleAuth(
  accessToken: string,
  state: string | null,
  redirectUri: string | null,
  scope: string,
  codeChallenge: string | null,
  codeChallengeMethod: string | null,
  resource: string | null
): Promise<Response> {
  // Validate the Supabase access token and get user info
  // Use anon key - getUser() validates the JWT which works with any key
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    console.error("[OAuth/GoogleCallback] Failed to validate token:", error);
    return new Response(
      `
<!DOCTYPE html>
<html>
<head><title>Authentication Failed</title></head>
<body style="font-family: sans-serif; padding: 40px; text-align: center;">
  <h1>Authentication Failed</h1>
  <p>Invalid or expired authentication token.</p>
  <p><a href="javascript:history.back()">Go Back</a></p>
</body>
</html>
      `,
      {
        status: 401,
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  console.log("[OAuth/GoogleCallback] User authenticated:", user.id, user.email);

  // Validate required OAuth parameters
  if (!redirectUri || !codeChallenge || !codeChallengeMethod) {
    return new Response(
      `
<!DOCTYPE html>
<html>
<head><title>Invalid Request</title></head>
<body style="font-family: sans-serif; padding: 40px; text-align: center;">
  <h1>Invalid Request</h1>
  <p>Missing OAuth parameters. Please try connecting again.</p>
</body>
</html>
      `,
      {
        status: 400,
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  // Generate authorization code
  const authCode = generateCode(32);

  // Store authorization code in Supabase (persistent across serverless invocations)
  const stored = await storeAuthCode(
    authCode,
    user.id,
    codeChallenge,
    codeChallengeMethod,
    redirectUri,
    scope,
    resource || null
  );

  if (!stored) {
    return new Response(
      `
<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body style="font-family: sans-serif; padding: 40px; text-align: center;">
  <h1>Authorization Failed</h1>
  <p>Failed to create authorization code. Please try again.</p>
</body>
</html>
      `,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }

  // Build the OAuth client redirect URL with the authorization code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", authCode);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  console.log("[OAuth/GoogleCallback] Redirecting to:", redirectUrl.toString());

  // Show success page that redirects and tells user they can close the tab
  return getSuccessPageHTML(redirectUrl.toString());
}

/**
 * Handle dynamic client registration (POST /oauth/register)
 * MCP clients can register themselves dynamically
 */
export async function handleRegister(req: Request): Promise<Response> {
  console.log(`[OAuth/Register] DCR request received`);

  let body: Record<string, unknown>;

  try {
    body = await req.json();
    console.log(`[OAuth/Register] Request body:`, body);
  } catch (e) {
    console.log(`[OAuth/Register] Invalid JSON body:`, e);
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "Invalid JSON body",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // For MCP, we accept any client registration
  // Echo back the redirect_uris they registered (required per RFC 7591)
  const redirectUris = body.redirect_uris as string[] | undefined;

  const response: Record<string, unknown> = {
    client_id: "mcp-client",
    client_name: body.client_name || "MCP Client",
    grant_types: body.grant_types || ["authorization_code"],
    response_types: body.response_types || ["code"],
    token_endpoint_auth_method: body.token_endpoint_auth_method || "none",
  };

  // Include redirect_uris if provided (required for OAuth to work)
  if (redirectUris && redirectUris.length > 0) {
    response.redirect_uris = redirectUris;
  }

  console.log(`[OAuth/Register] Returning client registration:`, response);

  return new Response(
    JSON.stringify(response),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }
  );
}
