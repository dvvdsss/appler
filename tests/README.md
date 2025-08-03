# Apple RAG MCP Server - Test Suite

## 概述

这个目录包含了 Apple RAG MCP Server 的完整测试套件，用于验证 MCP 协议合规性、功能正确性和系统安全性。

## 测试分类

### 🔧 Core MCP Protocol Tests (核心协议测试)

- **test-basic-mcp.js** - 基础 MCP 协议测试
  - Initialize 方法
  - Tools/List 方法
  - 协议版本验证

- **test-ping.js** - Ping 功能测试
  - 基础 ping 测试
  - 会话 ping 测试
  - 延迟测试

- **test-progress.js** - 进度追踪测试
  - 进度通知机制
  - Token 验证
  - 进度状态管理

### 🔍 Functionality Tests (功能测试)

- **test-final-rag.js** - 端到端 RAG 查询测试
  - 真实语义搜索
  - 查询响应验证
  - 性能测试

- **test-semantic-search.js** - 语义搜索质量测试
  - 语义相关性验证
  - 查询准确度测试
  - 结果质量评估

- **test-core-search.js** - 核心搜索功能测试
  - 数据库连接测试
  - 向量操作验证
  - 搜索算法测试

### 🔒 Security Tests (安全测试)

- **test-security.js** - 安全机制测试
  - 会话劫持防护
  - Token 传递防护
  - 会话过期机制

- **test-authorization.js** - 授权测试
  - OAuth 2.0 合规性
  - PKCE 支持
  - 权限验证

- **test-cancellation.js** - 请求取消测试
  - 基础取消功能
  - 长时间请求取消
  - 取消状态管理

### 🚀 Advanced Tests (高级测试)

- **test-streamable-http.js** - 流式 HTTP 测试
  - 会话管理
  - GET 端点处理
  - 会话终止

- **test-real-rag.js** - 真实 RAG 测试
  - 实际 API 集成
  - 真实数据库查询
  - 端到端验证

- **test-real-rag-mock.js** - 模拟 RAG 测试
  - 模拟 embedding 测试
  - 离线功能验证
  - 算法逻辑测试

## 测试数据

- **setup-test-data.js** - 测试数据设置脚本
  - 创建测试数据库表
  - 插入示例文档
  - 生成测试向量

## 使用方法

### 运行所有测试

```bash
# 使用统一测试脚本
pnpm test

# 或者直接运行脚本
scripts/run-tests.sh
```

### 运行特定类别的测试

```bash
# 核心协议测试
pnpm test:core

# 功能测试
pnpm test:functionality

# 安全测试
pnpm test:security

# 高级测试
pnpm test:advanced
```

### 运行单个测试

```bash
# 运行特定测试
pnpm test:progress
pnpm test:ping
pnpm test:rag

# 或者直接运行
cd tests && node test-progress.js
```

### 设置测试数据

```bash
# 设置测试数据并运行测试
pnpm test:setup

# 或者只设置数据
cd tests && node setup-test-data.js
```

## 测试前提条件

### 1. 服务器运行

确保 MCP 服务器正在运行：

```bash
pnpm dev
```

服务器应该在 `http://localhost:3001` 上运行。

### 2. 数据库配置

确保数据库连接正确配置：

- PostgreSQL 服务运行
- pgvector 扩展已安装
- 数据库连接参数正确

### 3. API 配置

确保 SiliconFlow API 密钥已配置：

```bash
# 检查 .env 文件
grep SILICONFLOW_API_KEY .env
```

## 测试输出

### 成功示例

```
🧪 Apple RAG MCP Server - Unified Test Suite
=============================================

🔍 Core MCP Protocol Tests
================================
✅ test-basic-mcp PASSED
✅ test-ping PASSED
✅ test-progress PASSED

📊 Test Summary
===============
ℹ️  Total tests: 13
✅ Passed: 13
✅ 🎉 All tests passed!
```

### 失败示例

```
❌ test-final-rag FAILED

📊 Test Summary
===============
ℹ️  Total tests: 13
✅ Passed: 12
❌ Failed: 1

❌ Failed tests:
  - test-final-rag

❌ Some tests failed. Please check the output above for details.
```

## 故障排除

### 常见问题

1. **服务器未运行**
   ```
   ❌ MCP server is not running
   ℹ️  Please start the server with: pnpm dev
   ```

2. **数据库连接失败**
   - 检查 PostgreSQL 服务状态
   - 验证数据库连接参数
   - 确保 pgvector 扩展已安装

3. **API 密钥问题**
   - 验证 SiliconFlow API 密钥
   - 检查 API 配额和限制

4. **测试文件不存在**
   ```
   ⚠️  Test file not found: test-example.js
   ```

### 调试技巧

1. **单独运行失败的测试**
   ```bash
   cd tests && node test-failing-test.js
   ```

2. **检查服务器日志**
   ```bash
   # 查看开发服务器输出
   pnpm dev
   ```

3. **验证数据库状态**
   ```bash
   # 检查数据库连接
   psql -h localhost -p 5432 -U apple_rag_user -d apple_rag_db -c "SELECT 1;"
   ```

## 添加新测试

### 创建新测试文件

1. 在 `tests/` 目录中创建新的测试文件
2. 使用现有测试作为模板
3. 更新 `scripts/run-tests.sh` 中的测试分类
4. 在 `package.json` 中添加对应的脚本

### 测试文件模板

```javascript
#!/usr/bin/env node
/**
 * Test Description
 */

import http from 'http';

// Test implementation
async function runTest() {
    console.log('🧪 Test Name');
    
    try {
        // Test logic here
        console.log('✅ Test passed');
        return true;
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        return false;
    }
}

runTest().then(success => {
    process.exit(success ? 0 : 1);
});
```

## 持续集成

这些测试可以集成到 CI/CD 流水线中：

```bash
# CI 脚本示例
npm install
npm run build
npm run dev &
sleep 5
npm test
```
