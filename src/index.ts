/**
 * Apple RAG MCP Server
 * Complete RAG query system proxy to API Gateway
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiGatewayClient } from "./api/client.js";

// Define our MCP agent with RAG tools
export class AppleRAGMCP extends McpAgent {
  server = new McpServer({
    name: "apple-rag-mcp-server",
    version: "1.0.0",
    description:
      "AI-powered Apple Developer Documentation RAG service using MCP protocol",
    author: "Apple RAG Team",
    license: "MIT",
  });

  private apiClient: ApiGatewayClient;

  constructor(env: any) {
    super(env, {});
    // Use hardcoded API Gateway URL - no environment variables needed
    this.apiClient = new ApiGatewayClient();
  }

  async init() {
    // Core RAG query tool - proxy to API Gateway
    this.server.tool(
      "perform_rag_query",
      {
        description:
          "Search Apple Developer Documentation using advanced RAG technology",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query for Apple Developer Documentation",
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
              description: "API key for authentication (required for access)",
            },
          },
          required: ["query", "api_key"],
        },
      },
      async ({ query, match_count, api_key }) => {
        try {
          // Proxy request to API Gateway
          const result = await this.apiClient.performRAGQuery(
            {
              query,
              match_count,
            },
            api_key
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    query,
                    error: String(error),
                    suggestion: "Please check your API key and try again.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const { pathname } = new URL(request.url);
    const path = pathname.replace(/\/$/, "");

    // SSE endpoint
    if (path === "/sse" || pathname === "/sse/message") {
      return AppleRAGMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    // MCP endpoint - support both /mcp and root path
    if (path === "/mcp" || path === "" || path === "/") {
      return AppleRAGMCP.serve("/mcp").fetch(request, env, ctx);
    }

    return new Response(
      JSON.stringify({
        error: "Endpoint not found",
        message: `Path '${pathname}' is not available. Available endpoints: / (root), /sse`,
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
