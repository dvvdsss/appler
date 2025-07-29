# Apple RAG MCP Server - 实现指南

## 项目概述

**目标**: 创建符合 MCP 授权规范的 OAuth 2.1 认证服务器，提供 Hello World 工具验证认证流程
**架构**: 直接实现 MCP 协议，支持 Bearer Token 认证，部署在 Cloudflare Workers
**域名**: `mcp.apple-rag.com`

## 核心实现架构

### 1. 直接 MCP 协议实现 (`src/direct-mcp-server.ts`)

**设计决策**: 放弃 Cloudflare Workers OAuth Provider，直接实现 MCP 协议
**原因**: OAuth Provider 返回 HTML 而不是 JSON，不兼容 MCP 客户端 HTTP 传输协议

```typescript
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // 直接处理HTTP请求，确保返回正确的JSON格式
  },
};
```

**关键实现点**:

- 根路径 `/` 同时支持 GET（服务器信息）和 POST（MCP 协议）
- 完整的 CORS 支持，包含 MCP 协议特有头部
- Bearer Token 验证，不触发 OAuth 重定向流程

### 2. CORS 配置 - 关键兼容性实现

**问题**: MCP 客户端发送特殊头部 `mcp-protocol-version`，标准 CORS 配置不支持
**解决**: 扩展 CORS 头部白名单

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept, mcp-protocol-version, x-mcp-client-id, x-mcp-client-version",
  "Access-Control-Max-Age": "86400",
};
```

**重要**: 必须包含所有 MCP 协议头部，否则浏览器环境会阻止请求

### 3. 端点路径设计

**MCP 客户端行为**: 默认连接根路径 `/` 而不是 `/mcp`
**实现策略**: 根路径同时处理信息查询和协议通信

```typescript
// 根路径处理逻辑
if (pathname === "/") {
  if (request.method === "POST") {
    // MCP协议处理
    return handleMCPProtocol(request);
  }
  if (request.method === "GET") {
    // 服务器信息
    return getServerInfo();
  }
}
```

### 4. OAuth 认证实现

**认证方式**: Bearer Token 直接验证，不使用完整 OAuth 流程
**Token 验证**: 硬编码测试 Token，生产环境需要连接数据库

```typescript
async function verifyOAuthToken(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.substring(7); // 移除 "Bearer "

  // 测试Token验证
  if (
    token ===
    "at_test_mcp_demo_2025_01_29_secure_token_for_apple_rag_system_v1_full_permissions"
  ) {
    return {
      valid: true,
      context: {
        userId: "test_user_demo_2025_01_29",
        username: "demo_user",
        permissions: ["rag.read", "rag.write", "admin"],
        claims: {
          /* JWT claims */
        },
      },
    };
  }

  return { valid: false, error: "Invalid token" };
}
```

### 5. MCP 协议处理

**支持的方法**:

- `initialize` - 协议初始化
- `tools/list` - 工具列表
- `tools/call` - 工具调用

**Hello 工具实现**:

```typescript
if (name === "hello") {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: `Hello World! 🌍\n\nOAuth 2.1 Authentication Successful!\n\n✅ Authenticated User Details:\n• User ID: ${
            authContext.userId
          }\n• Username: ${
            authContext.username
          }\n• Permissions: ${authContext.permissions.join(
            ", "
          )}\n• Token Claims: ${JSON.stringify(authContext.claims, null, 2)}`,
        },
      ],
    },
  };
}
```

## 关键兼容性努力

### 1. MCP 官方规范兼容

**协议版本**: `2025-03-26`
**JSON-RPC 格式**: 严格遵循 2.0 规范
**工具 Schema**: 完整的 inputSchema 定义

```typescript
{
  name: "hello",
  description: "Hello World with OAuth authentication verification",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
}
```

### 2. Cloudflare Workers 兼容

**入口点**: 标准的 fetch handler
**环境变量**: 通过 Env 接口访问
**响应格式**: 确保所有响应都是标准 Response 对象

```typescript
interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>
}
```

### 3. 浏览器环境兼容

**CORS 策略**: 完整的 preflight 支持
**Content-Type**: 所有响应都返回 `application/json`
**错误处理**: 标准 HTTP 状态码和 JSON-RPC 错误格式

## 踩过的坑和解决方案

### 坑 1: OAuth Provider 兼容性

**问题**: Cloudflare Workers OAuth Provider 返回 HTML
**解决**: 直接实现 MCP 协议，放弃第三方库

### 坑 2: 端点路径错误

**问题**: MCP 客户端连接 `/` 而不是 `/mcp`
**解决**: 根路径同时支持 GET 和 POST 请求

### 坑 3: OAuth 重定向误触发

**问题**: 提供 OAuth metadata 导致客户端尝试授权流程
**解决**: 移除 `/.well-known/oauth-protected-resource` 端点和 WWW-Authenticate 头

### 坑 4: CORS 配置不完整

**问题**: 缺少 MCP 协议头部导致浏览器阻止请求
**具体表现**: `Request header field mcp-protocol-version is not allowed by Access-Control-Allow-Headers in preflight response`
**环境差异**: curl 测试成功（不受 CORS 限制），浏览器环境失败（严格 CORS 策略）
**解决**: 扩展 CORS 头部白名单包含所有 MCP 协议头部

```typescript
// 修复前
"Access-Control-Allow-Headers": "Content-Type, Authorization, Accept"

// 修复后
"Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, mcp-protocol-version, x-mcp-client-id, x-mcp-client-version"
```

## 部署配置

### wrangler.toml

```toml
name = "apple-rag-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
routes = [
  { pattern = "mcp.apple-rag.com/*", zone_name = "apple-rag.com" }
]

[[env.production.kv_namespaces]]
binding = "OAUTH_KV"
id = "9b5243e561db4efcacf646f6b93ea9c4"
```

### 部署命令

```bash
npx wrangler deploy --env production
```

## 测试验证

### MCP 客户端连接配置

```
MCP Server URL: https://mcp.apple-rag.com
Header Name: Authorization
Bearer Value: at_test_mcp_demo_2025_01_29_secure_token_for_apple_rag_system_v1_full_permissions
```

### 基础连接测试

```bash
curl -X GET "https://mcp.apple-rag.com/" -H "Accept: application/json"
```

### MCP 协议完整测试

```bash
# 1. 初始化
curl -X POST "https://mcp.apple-rag.com/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer at_test_mcp_demo_2025_01_29_secure_token_for_apple_rag_system_v1_full_permissions" \
  -d '{"jsonrpc": "2.0", "method": "initialize", "id": 1}'

# 2. 工具列表
curl -X POST "https://mcp.apple-rag.com/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer at_test_mcp_demo_2025_01_29_secure_token_for_apple_rag_system_v1_full_permissions" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 2}'

# 3. Hello工具调用
curl -X POST "https://mcp.apple-rag.com/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer at_test_mcp_demo_2025_01_29_secure_token_for_apple_rag_system_v1_full_permissions" \
  -d '{"jsonrpc": "2.0", "method": "tools/call", "params": {"name": "hello", "arguments": {}}, "id": 3}'
```

### CORS 验证

```bash
curl -X OPTIONS "https://mcp.apple-rag.com/" \
  -H "Origin: https://playground.ai.cloudflare.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: mcp-protocol-version,authorization,content-type"
```

### 预期响应

**Hello 工具成功响应**:

```
Hello World! 🌍

OAuth 2.1 Authentication Successful!

✅ Authenticated User Details:
• User ID: test_user_demo_2025_01_29
• Username: demo_user
• Permissions: rag.read, rag.write, admin

🎉 OAuth 2.1 + MCP Authorization is working correctly!
Connection and authentication: SUCCESS! ✅
```

## 重要注意事项

1. **协议优先**: MCP 协议兼容性比 OAuth 完整性更重要
2. **环境测试**: 必须在浏览器环境测试，不能仅依赖 curl
3. **CORS 完整性**: 包含所有可能的 MCP 协议头部
4. **错误处理**: 返回标准 JSON-RPC 错误格式
5. **Token 验证**: 生产环境需要连接真实的用户数据库

## 生产环境扩展

当前实现是测试版本，生产环境需要：

1. 连接 D1 数据库进行 Token 验证
2. 实现完整的用户权限系统
3. 添加日志和监控
4. 实现 Token 刷新机制
5. 添加更多实用工具
