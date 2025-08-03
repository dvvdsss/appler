#!/bin/bash

# 从 apple-rag-api 复制真实的数据库配置到 MCP 项目
echo "🔧 正在从 apple-rag-api 复制真实的数据库配置..."

# 获取并设置 SILICONFLOW_API_KEY
echo "📡 复制 SiliconFlow API 密钥..."
SILICONFLOW_KEY=$(pnpm wrangler secret get SILICONFLOW_API_KEY --name apple-rag-api 2>/dev/null)
if [ ! -z "$SILICONFLOW_KEY" ]; then
    echo "$SILICONFLOW_KEY" | pnpm wrangler secret put SILICONFLOW_API_KEY
    echo "✅ SILICONFLOW_API_KEY 已复制"
else
    echo "❌ 无法获取 SILICONFLOW_API_KEY"
fi

# 获取并设置数据库配置
echo "🗄️ 复制数据库配置..."

DB_HOST=$(pnpm wrangler secret get EMBEDDING_DB_HOST --name apple-rag-api 2>/dev/null)
if [ ! -z "$DB_HOST" ]; then
    echo "$DB_HOST" | pnpm wrangler secret put EMBEDDING_DB_HOST
    echo "✅ EMBEDDING_DB_HOST 已复制"
fi

DB_DATABASE=$(pnpm wrangler secret get EMBEDDING_DB_DATABASE --name apple-rag-api 2>/dev/null)
if [ ! -z "$DB_DATABASE" ]; then
    echo "$DB_DATABASE" | pnpm wrangler secret put EMBEDDING_DB_DATABASE
    echo "✅ EMBEDDING_DB_DATABASE 已复制"
fi

DB_USER=$(pnpm wrangler secret get EMBEDDING_DB_USER --name apple-rag-api 2>/dev/null)
if [ ! -z "$DB_USER" ]; then
    echo "$DB_USER" | pnpm wrangler secret put EMBEDDING_DB_USER
    echo "✅ EMBEDDING_DB_USER 已复制"
fi

DB_PASSWORD=$(pnpm wrangler secret get EMBEDDING_DB_PASSWORD --name apple-rag-api 2>/dev/null)
if [ ! -z "$DB_PASSWORD" ]; then
    echo "$DB_PASSWORD" | pnpm wrangler secret put EMBEDDING_DB_PASSWORD
    echo "✅ EMBEDDING_DB_PASSWORD 已复制"
fi

echo "🎉 所有密钥复制完成！"
echo "📋 当前 MCP 项目的密钥列表："
pnpm wrangler secret list
