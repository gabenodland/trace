// MCP SSE (Server-Sent Events) Transport Protocol
// Handles SSE streaming for MCP over HTTP
//
// ⚠️ LIMITATION: This uses in-memory session storage which does NOT persist
// across Edge Function invocations on Vercel. Each request may hit a different
// instance, and instances are terminated after idle timeout.
//
// SSE sessions will only work reliably within a single request/response cycle.
// For multi-request session persistence, use external storage (Redis, database).
//
// The POST-based MCP transport (/mcp) is stateless and works reliably.

import type { McpResponse } from "./types";

/**
 * Format a message for SSE transport
 * MCP over SSE format: event: message\ndata: {...json...}\n\n
 */
export function formatSSEMessage(event: string, data: unknown): string {
  const jsonData = JSON.stringify(data);
  return `event: ${event}\ndata: ${jsonData}\n\n`;
}

/**
 * Format an MCP response for SSE
 */
export function formatMcpSSEMessage(response: McpResponse): string {
  return formatSSEMessage("message", response);
}

/**
 * Format SSE heartbeat/ping to keep connection alive
 */
export function formatSSEHeartbeat(): string {
  return `: heartbeat\n\n`;
}

/**
 * Format SSE endpoint message (sent on connection for session URL)
 */
export function formatSSEEndpoint(sessionId: string, baseUrl: string): string {
  const endpoint = `${baseUrl}/mcp?session_id=${sessionId}`;
  return formatSSEMessage("endpoint", endpoint);
}

/**
 * Create SSE response headers
 */
export function createSSEHeaders(corsHeaders: Record<string, string>): Headers {
  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no"); // Disable nginx buffering
  return headers;
}

/**
 * Create an SSE Response from an async generator
 */
export function createSSEResponse(
  stream: AsyncIterable<string>,
  corsHeaders: Record<string, string>
): Response {
  const headers = createSSEHeaders(corsHeaders);

  const readable = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (err) {
        console.error("[SSE] Stream error:", err);
        controller.error(err);
      }
    },
  });

  return new Response(readable, {
    status: 200,
    headers,
  });
}

/**
 * Create a simple SSE response with a single message
 */
export function createSingleMessageSSEResponse(
  response: McpResponse,
  corsHeaders: Record<string, string>
): Response {
  const message = formatMcpSSEMessage(response);
  const headers = createSSEHeaders(corsHeaders);

  return new Response(message, {
    status: 200,
    headers,
  });
}

/**
 * SSE Session Manager
 * Manages active SSE connections and message queuing
 */
export class SSESessionManager {
  private sessions: Map<string, SSESession> = new Map();

  /**
   * Create a new session
   */
  createSession(userId: string): SSESession {
    const sessionId = crypto.randomUUID();
    const session: SSESession = {
      id: sessionId,
      userId,
      createdAt: new Date(),
      messageQueue: [],
      isConnected: false,
      controller: null,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SSESession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Remove session
   */
  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.controller) {
      try {
        session.controller.close();
      } catch {
        // Already closed
      }
    }
    this.sessions.delete(sessionId);
  }

  /**
   * Queue a message for a session
   */
  queueMessage(sessionId: string, response: McpResponse): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[SSE] Session not found: ${sessionId}`);
      return;
    }

    if (session.isConnected && session.controller) {
      // Send immediately if connected
      const message = formatMcpSSEMessage(response);
      const encoder = new TextEncoder();
      try {
        session.controller.enqueue(encoder.encode(message));
      } catch {
        // Connection closed, queue for later
        session.messageQueue.push(response);
      }
    } else {
      // Queue for when client reconnects
      session.messageQueue.push(response);
    }
  }

  /**
   * Create SSE stream for a session
   */
  createSessionStream(
    sessionId: string,
    corsHeaders: Record<string, string>
  ): Response | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const headers = createSSEHeaders(corsHeaders);

    const readable = new ReadableStream({
      start: (controller) => {
        session.isConnected = true;
        session.controller = controller;

        const encoder = new TextEncoder();

        // Send any queued messages
        while (session.messageQueue.length > 0) {
          const response = session.messageQueue.shift()!;
          const message = formatMcpSSEMessage(response);
          controller.enqueue(encoder.encode(message));
        }
      },
      cancel: () => {
        session.isConnected = false;
        session.controller = null;
      },
    });

    return new Response(readable, {
      status: 200,
      headers,
    });
  }

  /**
   * Clean up expired sessions (older than 30 minutes)
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [id, session] of this.sessions) {
      if (now - session.createdAt.getTime() > maxAge) {
        this.removeSession(id);
      }
    }
  }
}

/**
 * SSE Session
 */
export interface SSESession {
  id: string;
  userId: string;
  createdAt: Date;
  messageQueue: McpResponse[];
  isConnected: boolean;
  controller: ReadableStreamDefaultController<Uint8Array> | null;
}

// Global session manager instance
export const sessionManager = new SSESessionManager();
