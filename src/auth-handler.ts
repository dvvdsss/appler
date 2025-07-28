/**
 * Apple RAG MCP Auth Handler - Modern CORS + OAuth 2.1 Implementation
 * Global optimal solution with zero redundancy
 */

interface Env {
  OAUTH_PROVIDER: any;
}

// Modern CORS configuration
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Requested-With',
  'Access-Control-Max-Age': '86400',
} as const;

export const AuthHandler = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // OAuth 2.1 Resource Server Metadata endpoint
    if (pathname === "/.well-known/oauth-protected-resource") {
      return new Response(
        JSON.stringify(
          {
            resource_server: "https://mcp.apple-rag.com",
            authorization_servers: ["https://api.apple-rag.com"],
            scopes_supported: ["rag.read", "rag.write", "admin"],
            bearer_methods_supported: ["header"],
            resource_documentation: "https://apple-rag.com/docs",
            authorization_endpoint: "https://apple-rag.com/oauth/authorize",
            token_endpoint: "https://api.apple-rag.com/oauth/token",
          },
          null,
          2
        ),
        {
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    }

    // Redirect all authorization requests to apple-rag-website frontend
    if (pathname === "/authorize") {
      const url = new URL(request.url);
      const redirectUrl = new URL("https://apple-rag.com/oauth/authorize");

      // Forward all OAuth parameters
      url.searchParams.forEach((value, key) => {
        redirectUrl.searchParams.set(key, value);
      });

      return Response.redirect(redirectUrl.toString(), 302);
    }

    // Default home page with integration info
    return new Response(getIntegratedHomePage(), {
      headers: {
        "Content-Type": "text/html",
        ...CORS_HEADERS,
      },
    });
  },
};

// All authorization logic moved to apple-rag-website for unified UX

function getIntegratedHomePage(): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Apple RAG MCP Server</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #000; color: #fff; }
        .header { text-align: center; margin-bottom: 40px; }
        .card { background: #18181b; padding: 30px; border-radius: 12px; margin: 20px 0; border: 1px solid #404040; }
        .btn { background: linear-gradient(to bottom, #60a5fa, #2563eb); color: white; padding: 12px 24px; border: none; border-radius: 8px; text-decoration: none; display: inline-block; transition: all 200ms; }
        .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(96, 165, 250, 0.3); }
        .integration { background: #27272a; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #525252; }
        .success { color: #34d399; }
        .code { background: #18181b; padding: 2px 6px; border-radius: 4px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🍎 Apple RAG MCP Server</h1>
        <p>Modern OAuth 2.1 + Model Context Protocol</p>
        <p class="success">✅ Unified Backend Architecture</p>
    </div>

    <div class="card">
        <h2>🔗 Unified Backend Architecture</h2>
        <p>This MCP server uses a unified OAuth 2.1 backend architecture with apple-rag-api for seamless authentication.</p>
        <p>Connect your MCP client to: <code class="code">https://mcp.apple-rag.com/mcp</code></p>
    </div>

    <div class="integration">
        <h3>🏗️ Architecture Benefits</h3>
        <ul style="color: #d4d4d8; line-height: 1.8;">
            <li><strong>Unified OAuth:</strong> Single backend handles all authentication</li>
            <li><strong>CORS Enabled:</strong> Cross-origin requests fully supported</li>
            <li><strong>OAuth 2.1 Metadata:</strong> Standard /.well-known endpoint</li>
            <li><strong>Session Sharing:</strong> Login once, use everywhere</li>
            <li><strong>Enterprise Security:</strong> OAuth 2.1 with PKCE protection</li>
            <li><strong>Zero Redundancy:</strong> Centralized user and token management</li>
        </ul>
    </div>

    <div class="card">
        <h3>🚀 OAuth 2.1 Flow</h3>
        <ol style="color: #d4d4d8; line-height: 1.8;">
            <li>MCP client fetches server metadata from <strong>/.well-known/oauth-protected-resource</strong></li>
            <li>Client initiates OAuth flow with CORS support</li>
            <li>User redirected to <strong>apple-rag.com/oauth/authorize</strong></li>
            <li>Frontend checks login status with React/Next.js</li>
            <li>If logged in: direct authorization, else: login + authorize</li>
            <li>Frontend calls backend API to generate tokens</li>
            <li>Return to MCP server with secure authorization</li>
        </ol>
        <div style="text-align: center; margin-top: 20px;">
            <a href="https://apple-rag.com" class="btn">Visit Apple RAG Website →</a>
        </div>
    </div>
</body>
</html>`;
}

// All HTML templates removed - using apple-rag-website for unified design
