# Apple RAG MCP Server - 实现指南

## 项目概述

**目标**: 创建高性能的 Apple 开发文档 RAG 搜索 MCP 服务器
**架构**: 基于 Fastify 的 Node.js 服务器，部署在 VPS 上
**技术栈**: TypeScript + Fastify + PostgreSQL + pgvector + PM2

## 核心实现架构

### 1. MCP 协议服务器 (`server.ts`)

**设计决策**: 使用 Fastify 框架实现高性能 MCP 协议服务器
**优势**: 高性能、类型安全、生产就绪

```typescript
import { fastify } from 'fastify';
import { MCPHandler } from './src/mcp-handler.js';

const server = fastify({
  logger: process.env.NODE_ENV === 'production' ? {
    level: 'info'
  } : {
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  }
});
```

**关键实现点**:

- 根路径 `/` 处理 MCP 协议请求
- `/health` 健康检查端点
- 完整的错误处理和日志记录
- 生产环境优化配置

### 2. RAG 搜索引擎 (`src/services/`)

**核心功能**: 向量搜索 Apple 开发文档
**技术实现**: PostgreSQL + pgvector + SiliconFlow 嵌入模型

```typescript
// 向量搜索实现
const searchResults = await this.db.query(`
  SELECT
    url, title, content, context,
    1 - (embedding <=> $1) as similarity
  FROM embeddings
  WHERE 1 - (embedding <=> $1) > $2
  ORDER BY similarity DESC
  LIMIT $3
`, [queryEmbedding, threshold, limit]);
```

**重要**: 使用余弦相似度进行语义搜索，支持高精度文档检索

### 3. 部署架构

**部署方式**: VPS + PM2 集群模式
**负载均衡**: PM2 自动负载均衡多个进程

```typescript
// PM2 生态系统配置
module.exports = {
  apps: [{
    name: 'apple-rag-mcp',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

### 4. 数据库设计

**向量存储**: PostgreSQL + pgvector 扩展
**表结构**: 优化的嵌入向量存储

```sql
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  context TEXT,
  embedding vector(2560),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);
```

### 5. MCP 协议实现

**支持的方法**:

- `initialize` - 协议初始化
- `tools/list` - 工具列表
- `tools/call` - RAG 查询工具

**查询工具实现**:

```typescript
{
  name: "query",
  description: "Search Apple Developer Documentation using advanced RAG technology",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query for Apple Developer Documentation"
      },
      match_count: {
        type: "number",
        description: "Number of results to return (1-20)",
        minimum: 1,
        maximum: 20,
        default: 5
      }
    },
    required: ["query"]
  }
}
```

## 技术特性

### 1. 高性能架构

**框架**: Fastify - 高性能 Node.js 框架
**数据库**: PostgreSQL + 连接池优化
**缓存**: 内存缓存 + 数据库查询优化

### 2. 生产环境优化

**日志系统**: Pino 高性能日志
**监控**: PM2 内置监控 + 自定义健康检查
**错误处理**: 完整的错误捕获和恢复机制

```typescript
// 生产环境日志配置
const logger = process.env.NODE_ENV === 'production' ? {
  level: 'info',
  redact: ['req.headers.authorization']
} : {
  level: 'debug',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
};
```

### 3. 安全特性

**CORS 策略**: 完整的 preflight 支持
**输入验证**: 严格的参数验证和清理
**错误处理**: 不泄露敏感信息的错误响应

## 环境配置管理

### 开发环境 vs 生产环境

| 配置项 | 开发环境 (`.env`) | 生产环境 (`.env.production`) |
|--------|------------------|------------------------------|
| **NODE_ENV** | `development` | `production` |
| **数据库主机** | `198.12.70.36` (远程) | `localhost` (本地) |
| **端口** | `3001` | `3001` |
| **会话密钥** | 开发密钥 | 生产密钥 |
| **日志级别** | `debug` | `info` |

### 环境文件说明

- **`.env`**: 当前使用的环境配置（开发环境）
- **`.env.production`**: 生产环境配置模板
- **`ENVIRONMENT_CONFIG.md`**: 详细的环境配置说明

### 生产环境配置步骤

```bash
# 1. 复制生产环境配置
cp .env.production .env

# 2. 编辑配置文件
nano .env

# 3. 确保以下配置正确：
# NODE_ENV=production
# EMBEDDING_DB_HOST=localhost
# SILICONFLOW_API_KEY=your-actual-api-key
```

## 部署和运维

### VPS 部署流程

#### 方法一：使用 pnpm 脚本（推荐）

```bash
# 1. 克隆代码
git clone <repository>
cd apple-rag-mcp

# 2. 配置生产环境
cp .env.production .env
# 编辑 .env 文件，设置正确的数据库连接和 API 密钥

# 3. 安装依赖
pnpm install

# 4. 构建项目
pnpm build

# 5. 启动生产服务（使用 PM2 集群模式）
pnpm start:prod
```

#### 方法二：使用部署脚本

```bash
# 1. 克隆代码
git clone <repository>
cd apple-rag-mcp

# 2. 运行自动化部署脚本
./deploy.sh
```

**注意**: `pnpm start:prod` 命令会自动执行以下操作：
- 构建 TypeScript 项目 (`pnpm build`)
- 使用 PM2 启动应用 (`pm2 start ecosystem.config.cjs --env production`)
- 配置集群模式和生产环境优化

### PM2 集群管理

```bash
# 启动集群（推荐使用 pnpm 脚本）
pnpm start:prod

# 或者直接使用 PM2
pm2 start ecosystem.config.cjs --env production

# 监控状态
pm2 status
pm2 monit

# 查看日志
pm2 logs apple-rag-mcp

# 重启服务
pm2 restart apple-rag-mcp

# 停止服务
pm2 stop apple-rag-mcp

# 删除服务
pm2 delete apple-rag-mcp
```

## 测试验证

### 本地开发测试

```bash
# 开发模式
pnpm dev

# 健康检查
curl http://localhost:3001/health

# MCP 协议测试
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{}}}'
```

### 生产环境测试

```bash
# RAG 查询测试
curl -X POST http://your-vps:3001/ \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"query","arguments":{"query":"Swift programming","match_count":2}}}'
```

## 性能优化

### 数据库优化

- 向量索引优化 (ivfflat)
- 连接池配置
- 查询缓存策略

### 应用优化

- PM2 集群模式
- 内存使用监控
- 响应时间优化

## 扩展计划

1. **多语言支持**: 支持中文查询
2. **缓存系统**: Redis 缓存热门查询
3. **API 限流**: 防止滥用
4. **用户系统**: 多用户支持
5. **监控告警**: 完整的运维监控
