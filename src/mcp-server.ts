/**
 * Apple RAG MCP Server - Modern OAuth 2.1 Implementation
 */

import { WorkerEntrypoint } from "cloudflare:workers";

interface AuthContext {
  userId: string;
  username: string;
  permissions: string[];
  claims: Record<string, any>;
}

interface Env {
  OAUTH_PROVIDER: any;
}

export class AppleRAGMCPServer extends WorkerEntrypoint<Env> {
  private get auth(): AuthContext {
    return this.ctx.props as AuthContext;
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    
    if (request.method === "OPTIONS") {
      return this.corsResponse();
    }

    if (request.method === "GET") {
      return this.handleGet();
    }

    if (request.method === "POST") {
      return this.handleJsonRpc(await request.json());
    }

    return this.errorResponse(404, "Not Found");
  }

  private async handleGet(): Promise<Response> {
    return this.jsonResponse({
      jsonrpc: "2.0",
      id: null,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: {
          name: "apple-rag-mcp",
          version: "2.0.0",
          description: "Apple RAG MCP Server with OAuth 2.1",
        },
      },
    });
  }

  private async handleJsonRpc(body: any): Promise<Response> {
    const { method, id, params } = body;

    switch (method) {
      case "initialize":
        return this.handleInitialize(id);
      case "ping":
        return this.handlePing(id);
      case "tools/list":
        return this.handleToolsList(id);
      case "tools/call":
        return this.handleToolsCall(id, params);
      default:
        return this.errorResponse(404, "Method not found", id);
    }
  }

  private async handleInitialize(id: string): Promise<Response> {
    return this.jsonResponse({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: "apple-rag-mcp",
          version: "2.0.0",
          description: "Apple RAG MCP Server with OAuth 2.1",
        },
      },
    });
  }

  private async handlePing(id: string): Promise<Response> {
    return this.jsonResponse({
      jsonrpc: "2.0",
      id,
      result: {},
    });
  }

  private async handleToolsList(id: string): Promise<Response> {
    const tools = [];

    // Basic tools for all authenticated users
    tools.push({
      name: "whoami",
      description: "Get current user information",
      inputSchema: {
        type: "object",
        properties: {},
      },
    });

    // RAG tools for users with rag.read permission
    if (this.hasPermission("rag.read")) {
      tools.push({
        name: "rag_query",
        description: "Search Apple Developer Documentation using RAG",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for Apple Developer Documentation",
            },
            limit: {
              type: "number",
              description: "Maximum number of results",
              default: 5,
              minimum: 1,
              maximum: 20,
            },
          },
          required: ["query"],
        },
      });
    }

    // Admin tools for users with admin permission
    if (this.hasPermission("admin")) {
      tools.push({
        name: "admin_status",
        description: "Get system status (admin only)",
        inputSchema: {
          type: "object",
          properties: {},
        },
      });
    }

    return this.jsonResponse({
      jsonrpc: "2.0",
      id,
      result: { tools },
    });
  }

  private async handleToolsCall(id: string, params: any): Promise<Response> {
    const { name, arguments: args } = params;

    switch (name) {
      case "whoami":
        return this.handleWhoami(id);
      case "rag_query":
        return this.requirePermission("rag.read", () => this.handleRagQuery(id, args));
      case "admin_status":
        return this.requirePermission("admin", () => this.handleAdminStatus(id));
      default:
        return this.errorResponse(404, "Tool not found", id);
    }
  }

  private async handleWhoami(id: string): Promise<Response> {
    return this.jsonResponse({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{
          type: "text",
          text: `Hello, ${this.auth.username}! You are authenticated with permissions: ${this.auth.permissions.join(", ")}`,
        }],
      },
    });
  }

  private async handleRagQuery(id: string, args: any): Promise<Response> {
    const { query, limit = 5 } = args;
    
    // TODO: Implement actual RAG query to Apple RAG API
    return this.jsonResponse({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{
          type: "text",
          text: `RAG Query: "${query}" (limit: ${limit}) - Implementation coming soon!`,
        }],
      },
    });
  }

  private async handleAdminStatus(id: string): Promise<Response> {
    return this.jsonResponse({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{
          type: "text",
          text: `System Status: OK | User: ${this.auth.username} | Permissions: ${this.auth.permissions.join(", ")}`,
        }],
      },
    });
  }

  private hasPermission(permission: string): boolean {
    return this.auth.permissions.includes(permission);
  }

  private async requirePermission(permission: string, handler: () => Promise<Response>): Promise<Response> {
    if (!this.hasPermission(permission)) {
      return this.jsonResponse({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32603,
          message: `Permission denied: requires ${permission}`,
        },
      });
    }
    return handler();
  }

  private jsonResponse(data: any): Response {
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        ...this.corsHeaders(),
      },
    });
  }

  private errorResponse(status: number, message: string, id?: string): Response {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: id || null,
        error: {
          code: status === 404 ? -32601 : -32603,
          message,
        },
      }),
      {
        status,
        headers: {
          "Content-Type": "application/json",
          ...this.corsHeaders(),
        },
      }
    );
  }

  private corsResponse(): Response {
    return new Response(null, {
      status: 200,
      headers: this.corsHeaders(),
    });
  }

  private corsHeaders(): Record<string, string> {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, mcp-protocol-version",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    };
  }
}
