/**
 * Apple RAG MCP Server
 * Complete RAG query system proxy to API Gateway
 */

import { ApiGatewayClient } from "./api/client";

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

    // SSE endpoint
    if (path === "/sse" || pathname === "/sse/message") {
      // Handle SSE requests
      if (request.headers.get("accept") === "text/event-stream") {
        return new Response("SSE endpoint - not yet implemented", {
          status: 501,
          headers: { "Content-Type": "text/plain" },
        });
      }
    }

    // MCP endpoint - support both /mcp and root path
    if (path === "/mcp" || path === "" || path === "/") {
      // Handle MCP requests using the server's request handler
      return await mcpServer.handleRequest(request);
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
