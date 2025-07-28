/**
 * Apple RAG MCP Auth Handler - Integrated with apple-rag-website
 * Global optimal solution with zero redundancy
 */

interface Env {
  OAUTH_PROVIDER: any;
}

export const AuthHandler = {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const { pathname } = new URL(request.url);

    // Redirect all authorization requests to apple-rag-website
    if (pathname === "/authorize") {
      const url = new URL(request.url);
      const redirectUrl = new URL("https://apple-rag.com/oauth/authorize");

      // Forward all OAuth parameters
      for (const [key, value] of url.searchParams.entries()) {
        redirectUrl.searchParams.set(key, value);
      }

      return Response.redirect(redirectUrl.toString(), 302);
    }

    // Default home page with integration info
    return new Response(getIntegratedHomePage(), {
      headers: { "Content-Type": "text/html" },
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
        <p class="success">✅ Integrated with Apple RAG Website</p>
    </div>

    <div class="card">
        <h2>🔗 Seamless Integration</h2>
        <p>This MCP server is now fully integrated with the Apple RAG website for a unified authentication experience.</p>
        <p>Connect your MCP client to: <code class="code">https://mcp.apple-rag.com/mcp</code></p>
    </div>

    <div class="integration">
        <h3>🎨 Design Integration</h3>
        <ul style="color: #d4d4d8; line-height: 1.8;">
            <li><strong>Unified Design:</strong> OAuth pages use the same Aceternity UI components</li>
            <li><strong>Brand Consistency:</strong> Seamless transition from website to authorization</li>
            <li><strong>Modern UX:</strong> Dark theme, animations, and responsive design</li>
            <li><strong>Zero Redundancy:</strong> Shared components and design system</li>
        </ul>
    </div>

    <div class="card">
        <h3>🚀 Authorization Flow</h3>
        <ol style="color: #d4d4d8; line-height: 1.8;">
            <li>MCP client initiates OAuth flow</li>
            <li>User redirected to <strong>apple-rag.com/oauth/authorize</strong></li>
            <li>Beautiful, branded authorization page</li>
            <li>Seamless authentication and consent</li>
            <li>Return to MCP server with authorization</li>
        </ol>
        <div style="text-align: center; margin-top: 20px;">
            <a href="https://apple-rag.com" class="btn">Visit Apple RAG Website →</a>
        </div>
    </div>
</body>
</html>`;
}

// All HTML templates removed - using apple-rag-website for unified design
