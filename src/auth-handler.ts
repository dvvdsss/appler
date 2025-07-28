/**
 * Apple RAG MCP Auth Handler - Modern OAuth 2.1 Implementation
 */

interface Env {
  OAUTH_PROVIDER: any;
}

// Mock user database - replace with real authentication
const USERS = {
  "admin": { password: "admin123", permissions: ["rag.read", "rag.write", "admin"] },
  "user": { password: "user123", permissions: ["rag.read"] },
  "demo": { password: "demo123", permissions: ["rag.read", "rag.write"] },
};

export const AuthHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    switch (pathname) {
      case "/authorize":
        return handleAuthorize(request, env);
      case "/login":
        return handleLogin(request, env);
      default:
        return new Response(getHomePage(), {
          headers: { "Content-Type": "text/html" },
        });
    }
  },
};

async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  if (request.method === "GET") {
    const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
    const clientInfo = await env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);
    
    return new Response(getAuthorizePage(oauthReqInfo, clientInfo), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (request.method === "POST") {
    const formData = await request.formData();
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const oauthState = formData.get("oauth_state") as string;

    // Authenticate user
    const user = USERS[username as keyof typeof USERS];
    if (!user || user.password !== password) {
      return new Response(getAuthorizePage(JSON.parse(oauthState), null, "Invalid credentials"), {
        status: 401,
        headers: { "Content-Type": "text/html" },
      });
    }

    // Complete OAuth authorization
    const oauthReqInfo = JSON.parse(oauthState);
    const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
      request: oauthReqInfo,
      userId: username,
      metadata: { label: `${username} - Apple RAG MCP Access` },
      scope: oauthReqInfo.scope,
      props: {
        userId: username,
        username: username,
        permissions: user.permissions,
        claims: {
          sub: username,
          name: username,
          iat: Math.floor(Date.now() / 1000),
        },
      },
    });

    return Response.redirect(redirectTo, 302);
  }

  return new Response("Method not allowed", { status: 405 });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  return new Response(getLoginPage(), {
    headers: { "Content-Type": "text/html" },
  });
}

function getHomePage(): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Apple RAG MCP Server</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .card { background: #f8f9fa; padding: 30px; border-radius: 12px; margin: 20px 0; }
        .btn { background: #007AFF; color: white; padding: 12px 24px; border: none; border-radius: 8px; text-decoration: none; display: inline-block; }
        .btn:hover { background: #0056CC; }
        .users { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🍎 Apple RAG MCP Server</h1>
        <p>Modern OAuth 2.1 + Model Context Protocol</p>
    </div>
    
    <div class="card">
        <h2>🔐 Authentication Required</h2>
        <p>This MCP server uses OAuth 2.1 for secure authentication and authorization.</p>
        <p>Connect your MCP client to: <code>https://mcp.apple-rag.com</code></p>
    </div>

    <div class="users">
        <h3>Demo Users</h3>
        <ul>
            <li><strong>admin</strong> / admin123 - Full access (rag.read, rag.write, admin)</li>
            <li><strong>user</strong> / user123 - Read-only access (rag.read)</li>
            <li><strong>demo</strong> / demo123 - Read/Write access (rag.read, rag.write)</li>
        </ul>
    </div>
</body>
</html>`;
}

function getAuthorizePage(oauthReqInfo: any, clientInfo: any, error?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Authorize - Apple RAG MCP</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 50px auto; padding: 20px; }
        .card { background: #f8f9fa; padding: 30px; border-radius: 12px; }
        .form-group { margin: 20px 0; }
        label { display: block; margin-bottom: 8px; font-weight: 600; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
        .btn { background: #007AFF; color: white; padding: 12px 24px; border: none; border-radius: 8px; width: 100%; font-size: 16px; cursor: pointer; }
        .btn:hover { background: #0056CC; }
        .error { background: #f8d7da; color: #721c24; padding: 12px; border-radius: 8px; margin: 20px 0; }
        .client-info { background: #d1ecf1; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .scopes { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🔐 Authorize Access</h1>
        
        ${clientInfo ? `
        <div class="client-info">
            <strong>Client:</strong> ${clientInfo.client_name || oauthReqInfo.clientId}<br>
            <strong>Redirect URI:</strong> ${oauthReqInfo.redirectUri}
        </div>
        ` : ''}
        
        <div class="scopes">
            <strong>Requested Permissions:</strong><br>
            ${Array.isArray(oauthReqInfo.scope) ? oauthReqInfo.scope.join(', ') : oauthReqInfo.scope}
        </div>

        ${error ? `<div class="error">${error}</div>` : ''}
        
        <form method="POST">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <input type="hidden" name="oauth_state" value='${JSON.stringify(oauthReqInfo)}'>
            
            <button type="submit" class="btn">Authorize & Login</button>
        </form>
    </div>
</body>
</html>`;
}

function getLoginPage(): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Login - Apple RAG MCP</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
        .card { background: #f8f9fa; padding: 30px; border-radius: 12px; text-align: center; }
        .form-group { margin: 20px 0; text-align: left; }
        label { display: block; margin-bottom: 8px; font-weight: 600; }
        input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 16px; }
        .btn { background: #007AFF; color: white; padding: 12px 24px; border: none; border-radius: 8px; width: 100%; font-size: 16px; cursor: pointer; }
        .btn:hover { background: #0056CC; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🍎 Apple RAG MCP</h1>
        <p>Please log in to continue</p>
        
        <form method="POST" action="/authorize">
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit" class="btn">Login</button>
        </form>
    </div>
</body>
</html>`;
}
