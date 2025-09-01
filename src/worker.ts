/**
 * Apple RAG MCP Server - Cloudflare Worker Native
 * Ultra-modern, zero-dependency MCP 2025-06-18 compliant server
 * Global optimal solution with maximum performance
 */

import { HEALTH_STATUS, SERVER_MANIFEST } from "./mcp/manifest.js";
import { MCPProtocolHandler } from "./mcp/protocol-handler.js";
import { createServices } from "./services/index.js";
import type { WorkerEnv } from "./types/index.js";
import { logger } from "./utils/logger.js";

/**
 * Cloudflare Worker entry point - Global optimal implementation
 * Handles all MCP protocol requests with edge-optimized performance
 */
export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    _ctx: ExecutionContext
  ): Promise<Response> {
    const startTime = performance.now();

    try {
      const url = new URL(request.url);

      // Health check endpoint - ultra-fast response
      if (request.method === "GET" && url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            ...HEALTH_STATUS,
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-cache",
            },
          }
        );
      }

      // Manifest endpoint - server discovery
      if (request.method === "GET" && url.pathname === "/manifest") {
        return new Response(JSON.stringify(SERVER_MANIFEST), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      // Handle GET requests for SSE streams (VPS compatibility)
      if (request.method === "GET" && url.pathname === "/") {
        const acceptHeader = request.headers.get("accept");
        if (acceptHeader?.includes("text/event-stream")) {
          // SSE stream support for VPS compatibility
          return new Response(
            new ReadableStream({
              start(controller) {
                // Send initial connection message
                controller.enqueue(new TextEncoder().encode(": connected\n\n"));

                // Keep connection alive with periodic heartbeat
                const heartbeat = setInterval(() => {
                  try {
                    controller.enqueue(
                      new TextEncoder().encode(": heartbeat\n\n")
                    );
                  } catch (_error) {
                    clearInterval(heartbeat);
                  }
                }, 30000);

                // Handle client disconnect
                setTimeout(() => {
                  clearInterval(heartbeat);
                  controller.close();
                }, 300000); // 5 minutes timeout
              },
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "Access-Control-Allow-Origin": "*",
              },
            }
          );
        } else {
          return new Response("Method Not Allowed", { status: 405 });
        }
      }

      // Handle POST /manifest requests (VPS compatibility)
      if (request.method === "POST" && url.pathname === "/manifest") {
        try {
          const body = await request.json();

          // Empty body → return manifest (common client behavior)
          if (!body || Object.keys(body).length === 0) {
            return new Response(JSON.stringify(SERVER_MANIFEST), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // MCP request to wrong endpoint → redirect to correct endpoint
          if (
            (body as unknown as { jsonrpc?: string; method?: string })
              .jsonrpc === "2.0" &&
            (body as unknown as { jsonrpc?: string; method?: string }).method
          ) {
            return new Response(
              JSON.stringify({
                error: "Endpoint redirect",
                message: "MCP protocol requests should be sent to /",
                redirect: "/",
              }),
              {
                status: 307,
                headers: {
                  "Content-Type": "application/json",
                  Location: "/",
                },
              }
            );
          }

          // Any other POST data → helpful error
          return new Response(
            JSON.stringify({
              error: "Invalid manifest request",
              message:
                "Use GET /manifest for server discovery or POST / for MCP communication",
              endpoints: {
                manifest: "GET /manifest",
                mcp: "POST /",
              },
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (_error) {
          return new Response(
            JSON.stringify({
              error: "Invalid JSON",
              message: "Request body must be valid JSON",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      // Initialize services with Worker environment
      const services = await createServices(env);

      // Authenticate request using auth service
      const authContext = await services.auth.optionalAuth(request);

      // Create MCP protocol handler
      const handler = new MCPProtocolHandler(services);

      // Handle MCP request
      const response = await handler.handleRequest(request, authContext);

      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorUrl = new URL(request.url);

      logger.error(
        "Worker error",
        {
          method: request.method,
          pathname: errorUrl.pathname,
          duration: Math.round(duration),
        },
        error instanceof Error ? error : new Error(String(error))
      );

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
        }
      );
    }
  },
};
