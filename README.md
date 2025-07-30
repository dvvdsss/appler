# Apple RAG MCP Server

> **Model Context Protocol (MCP) server with optional authentication and rate limiting**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![MCP Protocol](https://img.shields.io/badge/MCP-2025--03--26-green.svg)](https://modelcontextprotocol.io/)

## 📋 项目简介

Apple RAG MCP Server 是一个现代化的 Model Context Protocol (MCP) 服务器，支持可选认证和智能限流。它提供了完整的 MCP 协议实现，同时支持匿名用户和认证用户的差异化访问。

## ✨ 核心特性

- **🔐 可选认证** - 支持 Bearer Token 认证，同时允许匿名访问
- **🚫 智能限流** - 匿名用户每分钟 3 次请求限制，认证用户无限制
- **📊 使用记录** - 完整的匿名用户使用日志记录
- **🌐 协议完整** - 完整的 MCP 2025-03-26 协议实现
- **🔄 智能检测** - 基于 Accept headers 的协议自动检测
- **🛡️ CORS 支持** - 完整的跨域访问支持
- **💬 友好提示** - 限流时的用户友好英语提示

## 🚀 快速开始

### 📋 环境要求

- **Node.js**: 18.0+
- **npm**: 9.0+
- **Cloudflare CLI**: 最新版本

### ⚙️ 安装配置

1. **克隆项目**
   ```bash
   git clone https://github.com/your-org/apple-rag-mcp.git
   cd apple-rag-mcp
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **本地开发**
   ```bash
   npm run dev
   ```

4. **部署到生产环境**
   ```bash
   npm run deploy:prod
   ```

### 🔗 MCP 客户端配置

#### 匿名访问（无需认证）
```json
{
  "mcpServers": {
    "apple-rag": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch", "https://mcp.apple-rag.com"],
      "env": {}
    }
  }
}
```

#### 认证访问（推荐）
```json
{
  "mcpServers": {
    "apple-rag": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch", "https://mcp.apple-rag.com"],
      "env": {
        "BEARER_TOKEN": "your-api-token-here"
      }
    }
  }
}
```

## 🛠️ 可用工具

### hello
- **描述**: 测试 MCP 连接的 Hello World 工具
- **输入**: 无需参数
- **输出**:
  - **匿名用户**: 欢迎信息和升级提示
  - **认证用户**: 个人化问候和用户信息

## 🚫 限流机制

### 匿名用户限制
- **频率限制**: 每分钟最多 3 次请求
- **超限响应**: 友好的英语提示信息
- **重置时间**: 每分钟自动重置
- **使用记录**: 完整的 IP 和时间记录

### 认证用户权益
- **无限制访问**: 不受频率限制
- **完整功能**: 访问所有可用工具
- **个性化服务**: 基于用户信息的定制化响应

## 📊 使用记录

系统会记录所有匿名用户的使用情况：

```json
{
  "timestamp": "2025-01-29T16:00:00.000Z",
  "ip": "192.168.1.100",
  "served": true
}
```

**记录字段说明**：
- `timestamp`: 请求时间（ISO 8601 格式）
- `ip`: 客户端 IP 地址
- `served`: 是否提供服务（true=成功，false=被限流）

## 🔗 API 端点

- `/` - 主要 MCP 端点（智能协议检测）
- `/mcp` - 专用 MCP 端点
- `/sse` - Server-Sent Events 端点
- `/manifest` - 服务发现端点

## 🧪 测试指南

### 匿名访问测试

```bash
# 测试工具列表
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  https://mcp.apple-rag.com/

# 测试 hello 工具（第1次）
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"hello","arguments":{}}}' \
  https://mcp.apple-rag.com/

# 连续测试限流（第4次会被限制）
for i in {1..4}; do
  echo "第${i}次请求:"
  curl -X POST -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":${i},\"method\":\"tools/call\",\"params\":{\"name\":\"hello\",\"arguments\":{}}}" \
    https://mcp.apple-rag.com/
  echo ""
done
```

### 认证访问测试

```bash
# 使用 Bearer Token 测试（无限制）
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"hello","arguments":{}}}' \
  https://mcp.apple-rag.com/
```

### 预期响应

**匿名用户成功响应**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "Hello World! 🌍\n\nWelcome to Apple RAG MCP Server!\n\n✅ Anonymous Access:\n• Access Type: Anonymous User\n• No authentication required\n• Basic functionality available\n\n🎉 MCP Server is working perfectly!\n\n💡 Tip: For advanced features, consider getting an authentication token."
    }]
  }
}
```

**限流响应**：
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [{
      "type": "text",
      "text": "🚫 Rate limit reached!\n\nHi there! It looks like you're using our MCP server without an authentication token. To prevent abuse, anonymous users can make up to 3 requests per minute.\n\nYou've already made 4 requests in the last minute, so we need to pause here for a moment.\n\nWant unlimited access? Visit https://apple-rag.com to create your free account and get your personal authentication token. It only takes a minute and unlocks much higher rate limits!"
    }]
  }
}
```

## 🏗️ 技术实现

### 限流算法
- **固定窗口算法**: 基于分钟时间戳的计数器
- **存储方式**: Cloudflare KV 存储，自动 TTL 过期
- **IP 获取**: CF-Connecting-IP > X-Forwarded-For > X-Real-IP

### 日志记录
- **输出方式**: 直接 console.log 输出到 Cloudflare Logs
- **数据格式**: 精简的 3 字段 JSON 格式
- **记录时机**: 每次匿名请求都记录，无论是否提供服务

### 认证机制
- **可选认证**: 支持 Bearer Token，无 token 时自动创建匿名用户
- **用户上下文**: 统一的 UserContext 接口
- **向后兼容**: 认证用户完全不受限流影响
