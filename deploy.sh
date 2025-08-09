#!/bin/bash

# Apple RAG MCP Server - 一键部署脚本
# 最简化的生产环境部署流程

set -e

echo "🚀 Starting Apple RAG MCP deployment..."

# 检查当前目录
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# 1. 拉取最新代码
echo "📥 Pulling latest changes..."
git pull origin main

# 2. 安装依赖（如果需要）
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# 3. 构建项目
echo "🔨 Building project..."
pnpm build

# 4. 验证构建
if [ ! -f "dist/server.js" ]; then
    echo "❌ Build failed: dist/server.js not found"
    exit 1
fi

# 5. 重启服务
echo "🔄 Restarting PM2 service..."
pm2 restart apple-rag-mcp

# 6. 验证服务状态
echo "🔍 Checking service status..."
sleep 2
pm2 status apple-rag-mcp

echo ""
echo "✅ Deployment completed successfully!"
echo "📋 Service status:"
pm2 info apple-rag-mcp --no-color

echo ""
echo "📊 Recent logs:"
pm2 logs apple-rag-mcp --lines 5 --no-color

echo ""
echo "🌐 Health check:"
curl -s https://mcp.apple-rag.com/health | jq . || echo "Health check endpoint not responding"