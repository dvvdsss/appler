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

🍎 **Inject Apple Expertise into AI Agents via MCP**

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

### 🔑 Get Your API Key
- **Free to start:** No API key required for basic usage
- **Higher limits:** Get your API key at [apple-rag.com](https://apple-rag.com)
- **Dashboard:** Manage usage and tokens at [apple-rag.com/overview](https://apple-rag.com/overview)

### 🌟 Features
- 🍎 Complete Apple developer documentation access
- 🤖 AI-powered search with Qwen3-Reranker-8B
- ⚡ Hybrid search capabilities
- 🔒 Secure token-based authentication
- 📊 Usage analytics and monitoring

**Supported Clients:** Cursor, Claude Desktop, Cline, and all MCP-compatible tools."

echo "Creating tag: $TAG"
git tag -a "$TAG" -m "Release $VERSION: $COMMIT_MSG"

echo "Pushing tag to GitHub..."
git push origin "$TAG"

echo "Creating GitHub Release..."
gh release create "$TAG" --title "Apple RAG MCP $TAG" --notes "$RELEASE_NOTES"

echo "✅ Release $TAG created successfully!"
echo "🔗 View: https://github.com/BingoWon/apple-rag-mcp/releases/tag/$TAG"
