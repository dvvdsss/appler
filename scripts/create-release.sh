#!/bin/bash

# Automatic GitHub Release creation script
# Usage: ./scripts/create-release.sh [version] [type]
# Example: ./scripts/create-release.sh 1.0.0 patch
# Types: major, minor, patch, auto

set -e

# Check if GitHub CLI is available
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is required"
    echo "Install: brew install gh"
    exit 1
fi

# Check if logged into GitHub
if ! gh auth status &> /dev/null; then
    echo "Error: Please login to GitHub CLI first"
    echo "Run: gh auth login"
    exit 1
fi

# Get current version (if exists)
CURRENT_VERSION=$(git tag -l | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1 | sed 's/^v//')

# If no version provided, auto-generate
if [ -z "$1" ]; then
    if [ -z "$CURRENT_VERSION" ]; then
        VERSION="1.0.0"
        echo "📋 First release, using version: $VERSION"
    else
        # Auto-increment patch version
        IFS='.' read -ra PARTS <<< "$CURRENT_VERSION"
        MAJOR=${PARTS[0]}
        MINOR=${PARTS[1]}
        PATCH=$((${PARTS[2]} + 1))
        VERSION="$MAJOR.$MINOR.$PATCH"
        echo "📋 Auto-increment version: $CURRENT_VERSION → $VERSION"
    fi
else
    VERSION="$1"
fi

TAG="v$VERSION"

# Check if tag already exists
if git tag -l | grep -q "^$TAG$"; then
    echo "Error: Tag $TAG already exists"
    exit 1
fi

# Get latest commit information
COMMIT_MSG=$(git log -1 --pretty=format:"%s")
COMMIT_HASH=$(git log -1 --pretty=format:"%h")

# Get changes since last release
if [ -n "$CURRENT_VERSION" ]; then
    CHANGES=$(git log v$CURRENT_VERSION..HEAD --pretty=format:"- %s" | head -10)
else
    CHANGES=$(git log --pretty=format:"- %s" | head -10)
fi

# 生成Release Notes
RELEASE_NOTES="## Apple RAG MCP $TAG

 **Inject Apple Expertise into AI Agents via MCP**

### Recent Changes
$CHANGES

### 🚀 Quick Start

#### Option 1: One-Click Cursor Setup (Recommended)
[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en/install-mcp?name=apple-rag-mcp&config=eyJ1cmwiOiJodHRwczovL21jcC5hcHBsZS1yYWcuY29tIn0%3D)

#### Option 2: Manual Setup for Other MCP Clients
\`\`\`json
{
  \"mcpServers\": {
    \"apple-rag-mcp\": {
      \"url\": \"https://mcp.apple-rag.com\",
      \"headers\": {
        \"Authorization\": \"Bearer YOUR_API_KEY\"
      }
    }
  }
}
\`\`\`

### 🔑 Get Your MCP Token
- **Free to start:** No MCP Token required for basic usage
- **Higher limits:** Get your MCP Token at [apple-rag.com](https://apple-rag.com)
- **Dashboard:** Manage usage and tokens at [apple-rag.com/overview](https://apple-rag.com/overview)

### 🌟 Features
-  Complete Apple developer documentation access
- ⚡ Semantic Search for RAG capabilities
- 🔍 Keyword Search for precise technical term matching
- 🎯 Hybrid Search combining semantic and keyword search
- 🤖 AI-powered search with Qwen3-Reranker-8B
- 🔒 Secure token-based authentication
- 📊 Usage analytics and monitoring

**Supported Clients:** Cursor, Claude Desktop, Cline, and all MCP-compatible tools."

echo "Creating tag: $TAG"
git tag -a "$TAG" -m "Release $VERSION: $COMMIT_MSG"

echo "Pushing tag to GitHub..."
git push origin "$TAG"

echo "Creating GitHub Release..."
gh release create "$TAG" --title "Apple RAG MCP $TAG" --notes "$RELEASE_NOTES"

echo "📝 Updating version files..."

# Update package.json version
if [ -f "package.json" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
    else
        # Linux
        sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
    fi
    echo "✅ Updated package.json version to $VERSION"
fi

# Update server.json version to match the release
if [ -f "server.json" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" server.json
    else
        # Linux
        sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" server.json
    fi
    echo "✅ Updated server.json version to $VERSION"
else
    echo "⚠️  server.json not found, skipping version update"
fi

# Commit version updates
if git diff --quiet; then
    echo "ℹ️  No version changes to commit"
else
    echo "📝 Committing version updates..."
    git add package.json server.json 2>/dev/null || true
    git commit -m "chore: bump version to $VERSION" || true
    git push origin main || git push origin master || true
fi

echo "🚀 Publishing to MCP Registry..."
if command -v mcp-publisher &> /dev/null; then
    # Check if we need to re-authenticate
    if ! mcp-publisher publish 2>/dev/null; then
        echo "🔐 MCP authentication required or expired, re-authenticating..."
        if mcp-publisher login dns --domain apple-rag.com --private-key 1b2af17c7e095864f5591b8710ee72b6b2c7629f669f3bfb78b93ab9e3348134; then
            echo "✅ Re-authentication successful, publishing..."
            if mcp-publisher publish; then
                echo "✅ Successfully published to MCP Registry!"
            else
                echo "❌ MCP Registry publishing failed after re-authentication"
            fi
        else
            echo "❌ MCP re-authentication failed"
        fi
    else
        echo "✅ Successfully published to MCP Registry!"
    fi
else
    echo "⚠️  mcp-publisher not available"
    echo "   Install with: brew install mcp-publisher"
fi

echo "🚀 Deploying to environments..."

# Deploy to development environment
echo "📦 Deploying to development environment..."
if npm run deploy:dev; then
    echo "✅ Successfully deployed to development environment"
else
    echo "❌ Development deployment failed"
fi

# Deploy to production environment
echo "📦 Deploying to production environment..."
if npm run deploy:prod; then
    echo "✅ Successfully deployed to production environment"
else
    echo "❌ Production deployment failed"
fi

echo "✅ Release $TAG created successfully!"
echo "🔗 GitHub: https://github.com/BingoWon/apple-rag-mcp/releases/tag/$TAG"
echo "🔗 MCP Registry: https://registry.modelcontextprotocol.io/v0/servers?search=com.apple-rag/mcp-server"
echo "🌐 Development: https://dev.mcp.apple-rag.com"
echo "🌐 Production: https://mcp.apple-rag.com"
