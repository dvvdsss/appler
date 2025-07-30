/**
 * Apple RAG MCP Server - 纯Token认证实现
 * 现代精简的MCP协议服务器，无OAuth复杂性
 */

import { logger } from "./logger";

interface UserContext {
  userId: string;
  username: string;
  tier: string;
  created_at: string;
  is_active: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  resetTime: string;
}

interface MCPRequest {
  jsonrpc: string;
  id: number | string;
  method: string;
  params?: {
    name?: string;
    arguments?: any;
  };
}

function getClientIP(request: Request): string {
  const cfIP = request.headers.get("CF-Connecting-IP");
  if (cfIP) return cfIP;

  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIP = request.headers.get("X-Real-IP");
  if (realIP) return realIP;

  return "unknown";
}

async function checkRateLimit(ip: string, env: Env): Promise<RateLimitResult> {
  const currentMinute = Math.floor(Date.now() / 60000);
  const key = `rate_limit:${ip}:${currentMinute}`;

  const currentCount = parseInt((await env.TOKENS.get(key)) || "0");
  const newCount = currentCount + 1; // 包括当前这次调用

  if (currentCount >= 3) {
    // 被限流时，返回包括当前调用在内的总次数
    return {
      allowed: false,
      currentCount: newCount,
      resetTime: new Date((currentMinute + 1) * 60000).toISOString(),
    };
  }

  // 允许通过时，更新计数器
  await env.TOKENS.put(key, String(newCount), { expirationTtl: 120 });

  return {
    allowed: true,
    currentCount: newCount,
    resetTime: new Date((currentMinute + 1) * 60000).toISOString(),
  };
}

function logAnonymousUsage(ip: string, served: boolean): void {
  const record = {
    timestamp: new Date().toISOString(),
    ip,
    served,
  };
  console.log(JSON.stringify(record));
}

function createRateLimitResponse(id: number | string, currentCount: number) {
  const friendlyMessage = `🚫 Rate limit reached!

Hi there! It looks like you're using our MCP server without an authentication token. To prevent abuse, anonymous users can make up to 3 requests per minute.

You've already made ${currentCount} requests in the last minute, so we need to pause here for a moment.

Want unlimited access? Visit https://apple-rag.com to create your free account and get your personal authentication token. It only takes a minute and unlocks much higher rate limits!`;

  return {
    jsonrpc: "2.0" as const,
    id,
    result: {
      content: [
        {
          type: "text" as const,
          text: friendlyMessage,
        },
      ],
    },
  };
}

interface Env {
  TOKENS: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
        // 验证Token认证和检查限流
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
        const isAnonymous = user.userId === "anonymous";
        const ip = getClientIP(request);

        try {
          const body = (await request.json()) as MCPRequest;

          // 检查匿名用户的限流状态
          if (
            isAnonymous &&
            authResult.rateLimitResult &&
            !authResult.rateLimitResult.allowed
          ) {
            // 记录被限流的请求
            logAnonymousUsage(ip, false);

            return new Response(
              JSON.stringify(
                createRateLimitResponse(
                  body.id,
                  authResult.rateLimitResult.currentCount
                )
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

          // 记录成功的匿名请求
          if (isAnonymous) {
            logAnonymousUsage(ip, true);
          }

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
                "MCP server with optional authentication and hello world tool",
              protocol: "mcp",
              protocolVersion: "2025-03-26",
              capabilities: {
                tools: {},
              },
              authentication: "Optional Bearer Token",
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
  rateLimitResult?: RateLimitResult;
}> {
  const authHeader = request.headers.get("Authorization");

  // Handle anonymous access with rate limiting
  if (!authHeader?.startsWith("Bearer ")) {
    const ip = getClientIP(request);
    const rateLimitResult = await checkRateLimit(ip, env);

    logger.auth("anonymous_access", {
      reason: "no_token_provided",
      ip,
      rateLimitAllowed: rateLimitResult.allowed,
      currentCount: rateLimitResult.currentCount,
    });

    // Create anonymous user context
    const anonymousUser: UserContext = {
      userId: "anonymous",
      username: "Anonymous User",
      tier: "anonymous",
      created_at: new Date().toISOString(),
      is_active: true,
    };

    return {
      valid: true,
      user: anonymousUser,
      rateLimitResult,
    };
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
      tier: user.tier,
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
            description: "Hello World with optional authentication",
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
      const isAnonymous = user.userId === "anonymous";

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: isAnonymous
                ? `Hello World! 🌍

Welcome to Apple RAG MCP Server!

✅ Anonymous Access:
• Access Type: Anonymous User
• No authentication required
• Basic functionality available

🎉 MCP Server is working perfectly!

This confirms that:
- Anonymous access is enabled
- MCP protocol is functioning
- Basic tools are available

Connection: SUCCESS! ✅

💡 Tip: For advanced features, consider getting an authentication token.`
                : `Hello World! 🌍

Token Authentication Successful!

✅ User Details:
• User ID: ${user.userId}
• Username: ${user.username}
• Tier: ${user.tier}
• Active: ${user.is_active}

🎉 Authenticated access is working perfectly!

This confirms that:
- Bearer token authentication is working
- User context is properly passed
- Full functionality available
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
