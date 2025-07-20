/**
 * Apple RAG MCP Server
 * 完整的RAG查询系统，基于NEON PostgreSQL + SiliconFlow API
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RAGService } from "./rag/service.js";

// Define our MCP agent with RAG tools
export class AppleRAGMCP extends McpAgent {
  server = new McpServer({
    name: "Apple RAG Server",
    version: "1.0.0",
  });

  private ragService: RAGService | null = null;

  async init() {
    // 核心RAG查询工具 - 完全对齐Python版本
    this.server.tool(
      "perform_rag_query",
      {
        query: z
          .string()
          .describe("The search query for Apple Developer Documentation"),
        match_count: z
          .number()
          .default(5)
          .describe("Maximum number of results to return"),
      },
      async ({ query, match_count }) => {
        try {
          // 懒加载RAG服务 - 每个DO实例独立
          if (!this.ragService) {
            this.ragService = new RAGService(this.env);
          }

          const result = await this.ragService.performRAGQuery({
            query,
            matchCount: match_count,
          });

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

    // MCP endpoint
    if (path === "/mcp") {
      return AppleRAGMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // Health check endpoint
    if (path === "/health") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "Apple RAG MCP Server",
          timestamp: new Date().toISOString(),
          path: pathname,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(`Apple RAG MCP Server - Path not found: ${pathname}`, {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  },
};
