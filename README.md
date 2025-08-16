# Apple RAG MCP Server

> **现代化无状态 MCP 服务器，为 Apple 开发者文档提供智能搜索功能**

现代化的 MCP (Model Context Protocol) 服务器，使用先进的 RAG (Retrieval-Augmented Generation) 技术为 Apple 开发者文档提供智能搜索功能。完全符合 MCP 2025-06-18 规范，采用**无状态架构设计**，支持匿名访问和友好的限流体验。

## 🏗️ 架构设计

### 无状态服务架构 ⭐ **最新更新**
本项目采用**现代化无状态架构**，与 `apple-rag-api` 项目完全解耦：

- **� 无会话状态**: 完全移除会话管理，每个请求独立处理
- **�🔄 数据库直连**: 直接连接 Cloudflare D1（用户数据）和 PostgreSQL（向量搜索）
- **🚫 无 API 依赖**: 不调用 `apple-rag-api` 的任何接口，避免循环依赖
- **⚡ 高性能**: 减少网络调用和状态管理开销，提升响应速度
- **🛡️ 灵活认证**: 支持 MCP token 认证和匿名访问
- **🎯 智能限流**: 只对核心查询功能限流，基础功能始终可用

### 用户访问模式 ⭐ **最新更新**
- **🔑 认证用户**: 使用 MCP token，享受更高的查询限额
- **👤 匿名用户**: 无需 token，直接使用，有基础查询限额
- **🚀 友好限流**: 超限时提供友好提示和升级引导，工具调用不会失败

### 职责分工
- **apple-rag-mcp**: MCP 协议服务器，专注于文档搜索和 RAG 查询
- **apple-rag-api**: API 网关，专注于用户管理和 MCP token 管理

### 外部服务调用
- **SiliconFlow API**: 生成查询 embeddings（`https://api.siliconflow.cn/v1/embeddings`）
- **Cloudflare D1 REST API**: 数据库操作（`https://api.cloudflare.com/client/v4/accounts/.../d1/database/...`）

## ✨ 核心特性

### 🎯 MCP 协议支持 ⭐ **最新更新**
- **📋 MCP 2025-06-18 完全合规**: 完整实现所有 MCP 规范
- **🔧 简化工具接口**: 工具名称从 `query_apple_rag` 简化为 `query`
- **� 无状态设计**: 移除会话管理，每个请求独立处理
- **⚡ 即时响应**: 无需初始化，直接查询

### �🚀 性能与可靠性
- **🚀 高性能**: 高性能 Node.js 部署，无 CPU 时间限制
- **🔍 智能搜索**: 先进的向量搜索和语义理解
- **⚡ 生产就绪**: 内置错误处理、日志记录和监控
- **📊 全面覆盖**: 完整的 Apple 开发者文档支持
- **🏗️ 现代架构**: TypeScript + Fastify + PostgreSQL + pgvector

### 🛡️ 安全与访问控制 ⭐ **最新更新**
- **🔑 灵活认证**: 支持 MCP token 认证和匿名访问
- **🎯 智能限流**: 只对查询功能限流，基础功能始终可用
- **� 友好体验**: 限流时提供升级引导，不中断工具调用
- **📍 IP 追踪**: 准确记录用户 IP 地址用于分析和安全
- **�🛡️ 企业级安全**: 完整的 CORS、输入验证和安全头

### 🔧 部署与维护
- **🔧 独立部署**: 无外部 API 依赖，可独立运行
- **📊 完整日志**: 详细的查询日志和性能监控
- **🗄️ 数据库优化**: 移除外键约束，提升写入性能

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

### 匿名查询 ⭐ **最新更新**

```bash
# 匿名用户直接查询（无需 token）
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "query",
      "arguments": {
        "query": "SwiftUI navigation"
      }
    }
  }'
```

### 认证用户查询 ⭐ **最新更新**

```bash
# 使用 MCP token 查询（更高限额）
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -H "Authorization: Bearer your-mcp-token-here" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "query",
      "arguments": {
        "query": "Core Data relationships"
      }
    }
  }'
```

### 获取可用工具

```bash
# 获取工具列表（无需认证）
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

### 限流友好体验 ⭐ **最新更新**

当超过查询限额时，系统会返回友好提示而不是错误：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "Rate limit reached (100/month for anonymous users). Get a free account for higher limits: https://apple-rag.com/#pricing"
    }]
  }
}
```

## 📋 项目结构 ⭐ **最新更新**

```
apple-rag-mcp/
├── src/                    # 源代码
│   ├── auth/              # 认证相关
│   │   └── auth-middleware.ts      # 灵活认证中间件（支持 token 和匿名）
│   ├── services/          # 业务服务
│   │   ├── d1-connector.ts         # Cloudflare D1 连接器
│   │   ├── database-service.ts     # PostgreSQL 数据库服务
│   │   ├── embedding-service.ts    # SiliconFlow 嵌入服务
│   │   ├── query-logger.ts         # 查询日志服务（支持匿名用户）
│   │   ├── rag-service.ts          # RAG 核心服务
│   │   ├── rate-limit-service.ts   # 智能限流服务
│   │   └── search-engine.ts        # 混合搜索引擎
│   ├── types/             # 类型定义
│   │   ├── env.ts                  # 环境配置类型
│   │   └── rag.ts                  # RAG 相关类型
│   ├── mcp-handler.ts     # MCP 协议处理器（无状态设计）
│   ├── config.ts          # 配置管理
│   ├── logger.ts          # 日志服务
│   └── server.ts          # 主服务器文件
├── tests/                 # 测试文件
├── deploy.sh              # 部署脚本
└── ecosystem.config.cjs   # PM2 配置文件
```

### 🔄 架构变更说明 ⭐ **最新更新**

**移除的组件：**
- ❌ `session-service.ts` - 移除会话管理，采用无状态设计
- ❌ `oauth-metadata.ts` - 简化认证流程
- ❌ `token-validator.ts` - 集成到认证中间件
- ❌ `response-formatter.ts` - 简化响应处理

**新增/优化的组件：**
- ✅ `rate-limit-service.ts` - 智能限流，只对查询功能限流
- ✅ `mcp-handler.ts` - 无状态 MCP 协议处理器
- ✅ 优化的 `auth-middleware.ts` - 支持 token 和匿名访问
- ✅ 优化的 `query-logger.ts` - 支持匿名用户日志记录

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

## 📝 重要更新记录 ⭐ **最新改动**

### � v2.0.0 - 无状态架构重构 (2025-08-16)

#### 🏗️ 架构重大变更
- **🚫 移除会话管理**: 完全移除 `session-service.ts` 和所有会话相关逻辑
- **⚡ 无状态设计**: 每个请求独立处理，无需维护会话状态
- **🔧 简化工具接口**: 工具名称从 `query_apple_rag` 简化为 `query`
- **📍 IP 地址追踪**: 修复 IP 地址记录，从硬编码 "unknown" 改为真实 IP

#### 🛡️ 认证和访问控制优化
- **👤 匿名访问支持**: 无需 token 即可使用基础功能
- **🔑 灵活认证**: 支持 MCP token 认证和匿名访问两种模式
- **🎯 智能限流**: 只对 `tools/call` 查询功能限流，`initialize` 和 `tools/list` 不受限制
- **🚀 友好限流体验**: 超限时返回升级引导而非错误，工具调用不会失败

#### 🗄️ 数据库优化
- **⚡ 性能提升**: 移除 `usage_logs` 表的外键约束，提升写入性能
- **👤 匿名用户支持**: 匿名用户日志记录为 `user_id: "anonymous"`
- **📊 完整日志**: 保持完整的查询日志和 IP 地址记录

#### 🔧 代码质量改进
- **📦 代码精简**: 删除冗余的 `sendRateLimitError` 方法和复杂的参数传递
- **🎯 职责分离**: 限流逻辑只在 `tools/call` 中处理，其他请求不涉及
- **🔍 结果格式化**: 修复 RAG 结果显示，从错误消息改为格式化的搜索结果
- **⚡ 参数传递优化**: 修复 IP 地址传递链，确保日志记录准确

#### 📋 用户体验提升
- **🚀 即时可用**: 无需初始化或会话创建，直接查询
- **📝 友好提示**: 限流时提供清晰的升级引导和定价页面链接
- **📊 结果展示**: RAG 查询结果格式化为易读的列表，包含标题、内容和源链接
- **⚡ 响应速度**: 减少状态管理开销，提升整体响应速度

#### 🛠️ 技术债务清理
- **🗑️ 移除过时组件**: 删除 `session-service.ts`、`oauth-metadata.ts`、`token-validator.ts`
- **📁 文件结构优化**: 简化项目结构，移除不必要的工具函数
- **🔄 依赖关系简化**: 减少组件间的复杂依赖关系

## �🎉 生产就绪的无状态 MCP 服务器，完全符合 MCP 2025-06-18 规范！
