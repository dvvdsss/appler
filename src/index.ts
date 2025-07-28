/**
 * Apple RAG MCP Server - Hello World Version
 * 完全基于成功的 hello-world-mcp 项目
 */

export default {
  async fetch(request: Request): Promise<Response> {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, Accept, mcp-protocol-version, X-Requested-With",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    };

    const { pathname } = new URL(request.url);

    // Handle OPTIONS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Manifest endpoint for MCP client discovery (no auth required)
    if (
      pathname === "/manifest" ||
      pathname === "/.well-known/mcp" ||
      pathname === "/mcp-manifest"
    ) {
      return new Response(
        JSON.stringify({
          name: "apple-rag-mcp",
          version: "1.0.0",
          description: "Apple RAG MCP Server - Hello World Version",
          protocol: "mcp",
          protocolVersion: "2025-03-26",
          capabilities: {
            tools: {},
          },
          endpoints: {
            http: "/",
            sse: "/sse",
          },
          authentication: {
            type: "api_key",
            required: false,
          },
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // SSE endpoint for MCP communication
    if (pathname === "/sse") {
      const initMessage = {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "apple-rag-mcp", version: "1.0.0" },
        },
      };

      const sseData = `data: ${JSON.stringify(initMessage)}\n\n`;

      return new Response(sseData, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // HTTP JSON-RPC endpoint (root path)
    if (pathname === "/" || pathname === "/mcp") {
      // GET request - check Accept header for SSE
      if (request.method === "GET") {
        const acceptHeader = request.headers.get("Accept") || "";
        const isSSERequest = acceptHeader.includes("text/event-stream");

        // If SSE is requested, return SSE stream
        if (isSSERequest) {
          const initMessage = {
            jsonrpc: "2.0",
            method: "notifications/initialized",
            params: {
              protocolVersion: "2025-03-26",
              capabilities: { tools: {} },
              serverInfo: { name: "apple-rag-mcp", version: "1.0.0" },
            },
          };

          const sseData = `data: ${JSON.stringify(initMessage)}\n\n`;

          return new Response(sseData, {
            headers: {
              ...corsHeaders,
              "Content-Type": "text/event-stream; charset=utf-8",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        }

        // Otherwise return JSON server info
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            result: {
              protocolVersion: "2025-03-26",
              capabilities: { tools: {} },
              serverInfo: { name: "apple-rag-mcp", version: "1.0.0" },
            },
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // POST request - handle JSON-RPC
      if (request.method === "POST") {
        try {
          const body = (await request.json()) as any;

          // Simple authentication check (always allow for testing)
          const authHeader = request.headers.get("Authorization");
          const hasValidAuth = true; // Allow all requests for testing

          // Log the method being called for debugging
          console.log(`MCP method called: ${body.method}`, body);

          // Handle initialize method
          if (body.method === "initialize") {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  protocolVersion: "2025-03-26",
                  capabilities: {
                    tools: {},
                    resources: {},
                    prompts: {},
                  },
                  serverInfo: {
                    name: "apple-rag-mcp",
                    version: "1.0.0",
                    description: "Apple RAG MCP Server - Hello World Version",
                  },
                },
              }),
              {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }

          // Handle ping method
          if (body.method === "ping") {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: body.id,
                result: {},
              }),
              {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }

          // Handle notifications/initialized
          if (body.method === "notifications/initialized") {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: body.id,
                result: {},
              }),
              {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }

          // Handle tools/list method
          if (body.method === "tools/list") {
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  tools: [
                    {
                      name: "hello",
                      description: "Say hello to someone",
                      inputSchema: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            description: "The name of the person to greet",
                          },
                        },
                        required: ["name"],
                      },
                    },
                  ],
                },
              }),
              {
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            );
          }

          // Handle tools/call method
          if (body.method === "tools/call") {
            const { name, arguments: args } = body.params;

            if (name === "hello") {
              const personName = args.name || "World";
              return new Response(
                JSON.stringify({
                  jsonrpc: "2.0",
                  id: body.id,
                  result: {
                    content: [
                      {
                        type: "text",
                        text: `Hello, ${personName}! 🎉 This is the Apple RAG MCP Server.`,
                      },
                    ],
                  },
                }),
                {
                  headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                  },
                }
              );
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
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
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
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }
      }
    }

    // Default response
    return new Response(
      JSON.stringify({
        message: "Apple RAG MCP Server - Hello World Version",
        endpoints: ["/", "/mcp", "/sse"],
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  },
};
