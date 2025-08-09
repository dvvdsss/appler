# Apple RAG MCP Server

> **高性能 MCP 服务器，为 Apple 开发者文档提供智能搜索功能**

现代化的 MCP (Model Context Protocol) 服务器，使用先进的 RAG (Retrieval-Augmented Generation) 技术为 Apple 开发者文档提供智能搜索功能。完全符合 MCP 2025-06-18 规范，使用 Cloudflare D1 数据库进行用户认证。

## ✨ 核心特性

- **📋 MCP 2025-06-18 完全合规**: 完整实现所有 MCP 规范
- **🚀 高性能**: 高性能 Node.js 部署，无 CPU 时间限制
- **🔍 智能搜索**: 先进的向量搜索和语义理解
- **⚡ 生产就绪**: 内置会话管理、错误处理和监控
- **📊 全面覆盖**: 完整的 Apple 开发者文档支持
- **🏗️ 现代架构**: TypeScript + Fastify + PostgreSQL + pgvector
- **🛡️ 企业级安全**: 完整的认证、CORS、输入验证和安全头
- **🎯 会话管理**: 完整的会话生命周期和 `Mcp-Session-Id` 头支持

## 🛠 快速开始

### 系统要求

- **Node.js 18+**
- **PostgreSQL with pgvector extension**

### 部署步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/BingoWon/apple-rag-mcp.git
   cd apple-rag-mcp
   pnpm install
   ```

2. **配置环境**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件配置您的环境变量
   ```

3. **部署运行**
   ```bash
   ./deploy.sh
   ```

项目使用 PM2 进行进程管理，deploy.sh 脚本会自动处理构建和部署流程。

## 🧪 测试验证

测试服务器的 MCP 2025-06-18 合规性：

```bash
# 测试 MCP 进度合规性
cd tests && node test-progress.js

# 测试 MCP Ping 合规性
cd tests && node test-ping.js

# 测试 MCP 取消合规性
cd tests && node test-cancellation.js

# 测试安全最佳实践合规性
cd tests && node test-security.js

# 测试流式 HTTP 传输合规性
cd tests && node test-streamable-http.js

# 测试基础 MCP 协议合规性
cd tests && node test-basic-mcp.js

# 运行所有测试
pnpm test:all
```

## 🚀 使用方法

### 基本查询

```bash
# 基础 MCP 查询
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "apple_docs_search",
      "arguments": {
        "query": "SwiftUI navigation"
      }
    }
  }'
```

### 会话管理

```bash
# 创建会话
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Mcp-Session-Id: session-123" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

## 📋 项目结构

```
apple-rag-mcp/
├── src/                    # 源代码
│   ├── auth/              # 认证相关
│   ├── services/          # 业务服务
│   ├── types/             # 类型定义
│   └── utils/             # 工具函数
├── tests/                 # 测试文件
├── deploy.sh              # 部署脚本
└── server.ts              # 主服务器文件
```

## 🎉 生产就绪的 MCP 服务器，完全符合 MCP 2025-06-18 规范！
