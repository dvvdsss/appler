/**
 * Apple RAG MCP Server - 纯Token认证实现
 * 现代精简的MCP协议服务器，无OAuth复杂性
 */

import { logger } from "./logger";

interface UserContext {
  userId: string;
  username: string;
  permissions: string[];
}

interface Env {
  TOKENS: KVNamespace;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Log incoming request
    logger.request(request.method, pathname, {
      userAgent: request.headers.get("User-Agent"),
      origin: request.headers.get("Origin"),
    });

    // CORS headers for all responses - include MCP protocol headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, Accept, mcp-protocol-version, x-mcp-client-id, x-mcp-client-version",
      "Access-Control-Max-Age": "86400",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Remove OAuth metadata endpoint to prevent MCP client from trying OAuth flow
    // MCP client should use the provided Bearer token directly

    // Root path - handle both MCP protocol and info requests
    if (pathname === "/") {
      // If it's a POST request, treat as MCP endpoint
      if (request.method === "POST") {
        // 验证Token认证
        const authResult = await verifyToken(request, env);
        if (!authResult.valid) {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: null,
              error: {
                code: -32001,
                message: "Authentication required",
                data: {
                  error: "invalid_token",
                  error_description: authResult.error,
                },
              },
            }),
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            }
          );
        }

        const user = authResult.user!;

        try {
          const body = await request.json();
          const response = await handleMCPRequest(body, user);

          return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
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
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            }
          );
        }
      }

      // GET request - return server info
      if (request.method === "GET") {
        return new Response(
          JSON.stringify(
            {
              name: "Apple RAG MCP Server",
              version: "1.0.0",
              description:
                "OAuth 2.1 compliant MCP server with hello world tool",
              protocol: "mcp",
              protocolVersion: "2025-03-26",
              capabilities: {
                tools: {},
              },
              authentication: "OAuth 2.1 Bearer Token",
              endpoints: {
                mcp: "/",
              },
            },
            null,
            2
          ),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }

    // MCP endpoint - 备用端点（推荐使用根路径）
    if (pathname === "/mcp") {
      return new Response(
        JSON.stringify({
          message: "Please use root path / for MCP protocol",
          redirect: "/",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    // 404 for all other paths
    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders,
    });
  },
};

/**
 * 验证Bearer Token - 纯Token认证
 */
async function verifyToken(
  request: Request,
  env: Env
): Promise<{
  valid: boolean;
  user?: UserContext;
  error?: string;
}> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    logger.auth("authentication_failed", {
      reason: "missing_bearer_token",
      hasAuthHeader: !!authHeader,
    });
    return { valid: false, error: "Missing Bearer token" };
  }

  const token = authHeader.substring(7);

  logger.auth("token_verification_started", {
    tokenPrefix: token.substring(0, 10) + "...",
  });

  // 从KV存储中获取Token信息
  const tokenData = await env.TOKENS.get(token);
  if (!tokenData) {
    logger.auth("authentication_failed", {
      reason: "token_not_found",
      tokenPrefix: token.substring(0, 10) + "...",
    });
    return { valid: false, error: "Invalid token" };
  }

  try {
    const user = JSON.parse(tokenData) as UserContext;
    logger.auth("authentication_success", {
      userId: user.userId,
      username: user.username,
      permissions: user.permissions,
    });
    return { valid: true, user };
  } catch {
    logger.auth("authentication_failed", {
      reason: "malformed_token_data",
      tokenPrefix: token.substring(0, 10) + "...",
    });
    return { valid: false, error: "Malformed token data" };
  }
}

/**
 * 处理MCP JSON-RPC请求
 */
async function handleMCPRequest(body: any, user: UserContext): Promise<any> {
  const { method, id, params } = body;

  logger.mcp("request_received", {
    method,
    id,
    userId: user.userId,
    hasParams: !!params,
  });

  // Handle initialize
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: {
          name: "Apple RAG MCP Server",
          version: "2.0.0",
        },
      },
    };
  }

  // Handle tools/list
  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: [
          {
            name: "hello",
            description: "Hello World with Token authentication",
            inputSchema: {
              type: "object",
              properties: {},
              required: [],
            },
          },
        ],
      },
    };
  }

  // Handle tools/call
  if (method === "tools/call") {
    const { name } = params;

    if (name === "hello") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Hello World! 🌍

Token Authentication Successful!

✅ User Details:
• User ID: ${user.userId}
• Username: ${user.username}
• Permissions: ${user.permissions.join(", ")}

🎉 Pure Token Authentication is working perfectly!

This confirms that:
- Bearer token authentication is working
- User context is properly passed
- Permission system is active
- MCP protocol is functioning

Connection and authentication: SUCCESS! ✅`,
            },
          ],
        },
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown tool: ${name}` },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Unknown method: ${method}` },
  };
}
