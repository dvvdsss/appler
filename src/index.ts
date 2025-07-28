/**
 * Apple RAG MCP Server
 * Complete RAG query system proxy to API Gateway
 */

import { ApiGatewayClient } from "./api/client";

// CORS headers for Cloudflare AI Playground
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://playground.ai.cloudflare.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

// Define our MCP server with RAG tools
export class AppleRAGMCP {
  private apiClient: ApiGatewayClient;

  constructor() {
    // Use hardcoded API Gateway URL - no environment variables needed
    this.apiClient = new ApiGatewayClient();
  }

  async init() {
    // Initialization complete - no setup needed for simple proxy
  }

  // Handle SSE connections for MCP protocol
  async handleSSE(request: Request): Promise<Response> {
    // Handle preflight OPTIONS request
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // Create SSE stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Send initial MCP initialization
    const initMessage = {
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "apple-rag-mcp",
          version: "1.0.0",
        },
      },
    };

    // Send initialization message
    await writer.write(
      encoder.encode(`data: ${JSON.stringify(initMessage)}\n\n`)
    );

    // Keep connection alive with periodic heartbeat
    const heartbeatInterval = setInterval(async () => {
      try {
        const heartbeat = {
          jsonrpc: "2.0",
          method: "notifications/heartbeat",
          params: { timestamp: new Date().toISOString() },
        };
        await writer.write(
          encoder.encode(`data: ${JSON.stringify(heartbeat)}\n\n`)
        );
      } catch (error) {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // 30 seconds

    // Return SSE response
    return new Response(readable, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  async handleRequest(request: Request): Promise<Response> {
    try {
      // Parse JSON-RPC request
      const body = (await request.json()) as any;

      // Handle MCP methods
      if (body.method === "initialize") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              protocolVersion: "2025-03-26",
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: "apple-rag-mcp",
                version: "1.0.0",
              },
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (body.method === "tools/list") {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: body.id,
            result: {
              tools: [
                {
                  name: "perform_rag_query",
                  description:
                    "Search Apple Developer Documentation using advanced RAG technology",
                  inputSchema: {
                    type: "object",
                    properties: {
                      query: {
                        type: "string",
                        description:
                          "The search query for Apple Developer Documentation",
                      },
                      match_count: {
                        type: "number",
                        description: "Maximum number of results to return",
                        default: 5,
                        minimum: 1,
                        maximum: 20,
                      },
                      api_key: {
                        type: "string",
                        description:
                          "API key for authentication (required for access)",
                      },
                    },
                    required: ["query", "api_key"],
                  },
                },
              ],
            },
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (body.method === "tools/call") {
        const { name, arguments: args } = body.params;

        if (name === "perform_rag_query") {
          try {
            const result = await this.apiClient.performRAGQuery(
              {
                query: args.query,
                match_count: args.match_count,
              },
              args.api_key
            );

            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify(result, null, 2),
                    },
                  ],
                },
              }),
              {
                headers: { "Content-Type": "application/json" },
              }
            );
          } catch (error) {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify(
                        {
                          success: false,
                          query: args.query,
                          error: String(error),
                          suggestion:
                            "Please check your API key and try again.",
                        },
                        null,
                        2
                      ),
                    },
                  ],
                },
              }),
              {
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
      }

      // Method not found
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          error: {
            code: -32601,
            message: "Method not found",
          },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }
}

export default {
  async fetch(
    request: Request,
    env: any,
    ctx: ExecutionContext
  ): Promise<Response> {
    const { pathname } = new URL(request.url);
    const path = pathname.replace(/\/$/, "");

    // Create MCP server instance
    const mcpServer = new AppleRAGMCP();
    await mcpServer.init();

    // Handle OPTIONS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // SSE endpoint for MCP communication
    if (path === "/sse" || pathname === "/sse/message") {
      return mcpServer.handleSSE(request);
    }

    // MCP endpoint - support both /mcp and root path
    if (path === "/mcp" || path === "" || path === "/") {
      // Handle MCP requests using the server's request handler
      const response = await mcpServer.handleRequest(request);

      // Add CORS headers to MCP responses
      const headers = new Headers(response.headers);
      Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return new Response(
      JSON.stringify({
        error: "Endpoint not found",
        message: `Path '${pathname}' is not available. Available endpoints: / (root), /mcp, /sse`,
        service: "Apple RAG MCP Server",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  },
};
