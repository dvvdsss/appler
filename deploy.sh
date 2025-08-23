#!/bin/bash

# Apple RAG MCP Server - One-Click Deployment Script
# Simplified production environment deployment workflow

set -e

# Prevent infinite restart loops
if [[ "${DEPLOY_SCRIPT_RESTARTED}" == "true" ]]; then
  echo "🔄 Running with updated deploy script..."
  unset DEPLOY_SCRIPT_RESTARTED
fi

echo "🚀 Starting Apple RAG MCP deployment..."

# Check current directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# 1. Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# 1.1. Check if deploy.sh was updated and restart if needed
if [[ "${DEPLOY_SCRIPT_RESTARTED}" != "true" ]] && git diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -q "deploy.sh"; then
  echo "🔄 Deploy script was updated, restarting with new version..."
  export DEPLOY_SCRIPT_RESTARTED=true
  exec bash "$0" "$@"
fi

# 2. Install dependencies (if needed)
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# 3. Build project
echo "🔨 Building project..."
pnpm build

# 4. Verify build
if [ ! -f "dist/server.js" ]; then
    echo "❌ Build failed: dist/server.js not found"
    exit 1
fi

# 5. Restart service
echo "🔄 Restarting PM2 service..."
pm2 restart apple-rag-mcp

# 6. Verify service status
echo "🔍 Checking service status..."
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
curl -s https://mcp.apple-rag.com/health | jq . || echo "Health check endpoint not responding"# Test comment for deploy.sh update
