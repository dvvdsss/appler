# Apple RAG MCP Server

> **高性能 MCP 服务器，为 Apple 开发者文档提供智能搜索功能**

现代化的 MCP (Model Context Protocol) 服务器，使用先进的 RAG (Retrieval-Augmented Generation) 技术为 Apple 开发者文档提供智能搜索功能。完全符合 MCP 2025-06-18 规范，采用独立架构设计，直接连接数据库和外部服务。

## 🏗️ 架构设计

### 独立服务架构
本项目采用**独立服务架构**，与 `apple-rag-api` 项目完全解耦：

- **🔄 数据库直连**: 直接连接 Cloudflare D1（token 验证）和 PostgreSQL（向量搜索）
- **🚫 无 API 依赖**: 不调用 `apple-rag-api` 的任何接口，避免循环依赖
- **⚡ 高性能**: 减少网络调用，提升响应速度
- **🛡️ 独立认证**: 内置 TokenValidator，直接查询数据库验证 MCP token

### 职责分工
- **apple-rag-mcp**: MCP 协议服务器，专注于文档搜索和 RAG 查询
- **apple-rag-api**: API 网关，专注于用户管理和 MCP token 管理

### 外部服务调用
- **SiliconFlow API**: 生成查询 embeddings（`https://api.siliconflow.cn/v1/embeddings`）
- **Cloudflare D1 REST API**: 数据库操作（`https://api.cloudflare.com/client/v4/accounts/.../d1/database/...`）

## ✨ 核心特性

- **📋 MCP 2025-06-18 完全合规**: 完整实现所有 MCP 规范
- **🚀 高性能**: 高性能 Node.js 部署，无 CPU 时间限制
- **🔍 智能搜索**: 先进的向量搜索和语义理解
- **⚡ 生产就绪**: 内置会话管理、错误处理和监控
- **📊 全面覆盖**: 完整的 Apple 开发者文档支持
- **🏗️ 现代架构**: TypeScript + Fastify + PostgreSQL + pgvector
- **🛡️ 企业级安全**: 完整的认证、CORS、输入验证和安全头
- **🎯 会话管理**: 完整的会话生命周期和 `Mcp-Session-Id` 头支持
- **🔧 独立部署**: 无外部 API 依赖，可独立运行

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
│   │   ├── auth-middleware.ts      # OAuth 2.1 认证中间件
│   │   ├── oauth-metadata.ts       # OAuth 元数据服务
│   │   └── token-validator.ts      # MCP Token 验证器（直连 D1）
│   ├── services/          # 业务服务
│   │   ├── d1-connector.ts         # Cloudflare D1 连接器
│   │   ├── database-service.ts     # PostgreSQL 数据库服务
│   │   ├── embedding-service.ts    # SiliconFlow 嵌入服务
│   │   ├── query-logger.ts         # 查询日志服务
│   │   ├── rag-service.ts          # RAG 核心服务
│   │   ├── search-engine.ts        # 混合搜索引擎
│   │   └── session-service.ts      # MCP 会话管理
│   ├── types/             # 类型定义
│   │   ├── env.ts                  # 环境配置类型
│   │   └── rag.ts                  # RAG 相关类型
│   └── utils/             # 工具函数
│       └── response-formatter.ts   # 响应格式化
├── tests/                 # 测试文件
├── deploy.sh              # 部署脚本
├── server.ts              # 主服务器文件
└── ecosystem.config.cjs   # PM2 配置文件
```

## 🔧 技术栈

### 核心技术
- **Node.js 18+**: 运行时环境
- **TypeScript**: 类型安全的开发语言
- **Fastify**: 高性能 Web 框架
- **PostgreSQL + pgvector**: 向量数据库
- **Cloudflare D1**: 用户和 token 数据存储

### 外部服务
- **SiliconFlow API**: 文本嵌入生成（Qwen3-Embedding-4B 模型）
- **Cloudflare D1 REST API**: 数据库操作接口

### 部署工具
- **PM2**: 进程管理器
- **pnpm**: 包管理器

## 🔗 与 apple-rag-api 的关系

### 架构独立性
本项目与 `apple-rag-api` 项目在架构上完全独立：

| 方面 | apple-rag-mcp | apple-rag-api |
|------|---------------|---------------|
| **主要职责** | MCP 协议服务器，文档搜索 | API 网关，用户管理 |
| **数据库访问** | 直连 D1 + PostgreSQL | 通过 Hono 访问 D1 |
| **Token 验证** | 内置 TokenValidator | 提供 token 管理接口 |
| **外部依赖** | SiliconFlow API, Cloudflare D1 API | Stripe, Resend |
| **部署方式** | VPS + PM2 | Cloudflare Workers |

### 数据流向
```
MCP Client → apple-rag-mcp → [D1 Database, PostgreSQL, SiliconFlow API]
                ↑
                └── 共享 D1 数据库（用户和 token 数据）
                ↓
Web Client → apple-rag-api → [D1 Database, Stripe, Resend]
```

**注意**: Web 客户端不进行 RAG 查询，仅用于用户管理和 token 管理。

### 设计优势
- **🚫 避免循环依赖**: 两个服务互不调用，架构清晰
- **⚡ 性能优化**: MCP 服务直连数据库，减少网络延迟
- **🔧 独立部署**: 可以独立升级和维护
- **🛡️ 故障隔离**: 一个服务的问题不会影响另一个

## 🎉 生产就绪的 MCP 服务器，完全符合 MCP 2025-06-18 规范！
