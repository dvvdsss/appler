#!/bin/bash

# 自动创建GitHub Release的脚本
# 使用方法: ./scripts/create-release.sh [version]
# 例如: ./scripts/create-release.sh 1.0.0

set -e

# 检查是否提供了版本号
if [ -z "$1" ]; then
    echo "错误: 请提供版本号"
    echo "使用方法: $0 <version>"
    echo "例如: $0 1.0.0"
    exit 1
fi

VERSION="$1"
TAG="v$VERSION"

# 检查是否已经存在该标签
if git tag -l | grep -q "^$TAG$"; then
    echo "错误: 标签 $TAG 已存在"
    exit 1
fi

# 获取最新的commit信息
COMMIT_MSG=$(git log -1 --pretty=format:"%s")
COMMIT_HASH=$(git log -1 --pretty=format:"%h")

# 生成Release Notes
RELEASE_NOTES="## Release $TAG

### Changes
- $COMMIT_MSG (commit: $COMMIT_HASH)

### Installation
\`\`\`bash
git clone https://github.com/BingoWon/apple-rag-mcp.git
cd apple-rag-mcp
npm install
npm run build
\`\`\`

### Deployment
This release is designed to run on your own VPS server."

echo "创建标签: $TAG"
git tag -a "$TAG" -m "Release $VERSION: $COMMIT_MSG"

echo "推送标签到GitHub..."
git push origin "$TAG"

echo "✅ 标签 $TAG 已创建并推送到GitHub"
echo "📋 GitHub将自动创建Release页面"
echo "🔗 查看: https://github.com/BingoWon/apple-rag-mcp/releases/tag/$TAG"
