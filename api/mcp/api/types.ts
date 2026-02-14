// MCP (Model Context Protocol) TypeScript Types
// For Trace App MCP Server Edge Function

/**
 * MCP JSON-RPC 2.0 Request
 */
export interface McpRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * MCP JSON-RPC 2.0 Response
 */
export interface McpResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: McpError;
}

/**
 * MCP JSON-RPC Error
 */
export interface McpError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Standard JSON-RPC error codes
 */
export const McpErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific error codes
  UNAUTHORIZED: -32001,
  FORBIDDEN: -32003,
  RATE_LIMITED: -32029,
} as const;

/**
 * MCP Tool Definition
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, McpToolProperty>;
    required?: string[];
  };
}

/**
 * MCP Tool Property (JSON Schema subset)
 */
export interface McpToolProperty {
  type: "string" | "number" | "boolean" | "array" | "object";
  description?: string;
  enum?: string[];
  items?: McpToolProperty;
  default?: unknown;
}

/**
 * MCP Capabilities Response
 */
export interface McpCapabilities {
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: {
    tools?: {
      listChanged?: boolean;
    };
    resources?: {
      subscribe?: boolean;
      listChanged?: boolean;
    };
    prompts?: {
      listChanged?: boolean;
    };
  };
}

/**
 * MCP Tool Call Result
 */
export interface McpToolResult {
  content: McpContent[];
  isError?: boolean;
}

/**
 * MCP Content Block
 */
export interface McpContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
}

/**
 * API Key scope levels
 */
export type ApiKeyScope = "read" | "full";

/**
 * Validated auth result from API key check
 */
export interface AuthResult {
  userId: string;
  scope: ApiKeyScope;
  keyId: string;
  keyName: string;
}

/**
 * API Key record from database
 */
export interface ApiKeyRecord {
  api_key_id: string;
  user_id: string;
  name: string;
  key_prefix: string;   // First 16 chars of key (e.g., "tr_live_abcd1234")
  key_hash: string;
  scope: ApiKeyScope;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

/**
 * Available MCP methods
 */
export type McpMethod =
  | "initialize"
  | "initialized"
  | "ping"
  | "tools/list"
  | "tools/call"
  | "resources/list"
  | "resources/read"
  | "prompts/list"
  | "prompts/get";

/**
 * Helper to create MCP success response
 */
export function createMcpResponse(id: string | number, result: unknown): McpResponse {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

/**
 * Helper to create MCP error response
 */
export function createMcpError(
  id: string | number,
  code: number,
  message: string,
  data?: unknown
): McpResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      data,
    },
  };
}

/**
 * Helper to create tool result content
 */
export function createTextContent(text: string): McpContent {
  return {
    type: "text",
    text,
  };
}

/**
 * Helper to create image content (base64 encoded)
 */
export function createImageContent(base64Data: string, mimeType: string): McpContent {
  return {
    type: "image",
    data: base64Data,
    mimeType,
  };
}
