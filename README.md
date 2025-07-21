# 🍎 Apple RAG MCP Server

> **Professional MCP Proxy Service for Apple Developer Documentation**
> Deployed at: `mcp.apple-rag.com`
> Powered by Cloudflare Workers

🚀 **AI-Powered Apple Developer Documentation Search** - Connect with your API key!

## 🚀 **Quick Start - Get Your API Key**

**3 Simple Steps:**
1. Visit [apple-rag.com](https://apple-rag.com) to register and get your API key
2. Configure your MCP client with our service endpoint
3. Start querying Apple Developer Documentation with AI!

### 🔗 **Available Endpoints**

| Protocol | Endpoint | Best For |
|----------|----------|----------|
| **SSE** | `https://mcp.apple-rag.com/sse` | Real-time applications, streaming |
| **HTTP** | `https://mcp.apple-rag.com/` | Standard MCP clients, batch queries |

### ⚡ **Configuration with API Key**

#### For Claude Desktop
1. **Get your API key** from [apple-rag.com](https://apple-rag.com)
2. **Add this to your MCP configuration file**:

```json
{
  "mcpServers": {
    "apple-rag": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.apple-rag.com/sse"
      ]
    }
  }
}
```

3. **Use the tool with your API key**:
   - When calling `perform_rag_query`, include your API key as a parameter
   - Example: `perform_rag_query(query="SwiftUI navigation", api_key="ak_live_your_key_here")`

#### For Other MCP Clients
- **SSE Connection**: `https://mcp.apple-rag.com/sse`
- **HTTP Connection**: `https://mcp.apple-rag.com/`

### 🧪 **Test Connection**

```bash
# Test SSE connection
curl -H "Accept: text/event-stream" https://mcp.apple-rag.com/sse

# Note: Actual queries require a valid API key from apple-rag.com
```

### 🛠️ **Available Tools**

Once connected, you can use the `perform_rag_query` tool with your API key:

```typescript
// Query Apple Developer Documentation
await callTool("perform_rag_query", {
  query: "How to implement SwiftUI navigation",
  match_count: 3,  // Optional: number of results (default: 5)
  api_key: "ak_live_your_key_here"  // Required: Your API key from apple-rag.com
});
```

**Response Format:**
```json
{
  "success": true,
  "query": "How to implement SwiftUI navigation",
  "search_mode": "hybrid",
  "results": [
    {
      "url": "https://developer.apple.com/documentation/swiftui/navigation",
      "content": "SwiftUI provides several ways to implement navigation...",
      "similarity": 0.95
    }
  ],
  "count": 1
}
```

### 🔄 **Protocol Differences**

| Feature | SSE Endpoint | HTTP Endpoint |
|---------|--------------|---------------|
| **Connection** | Persistent, real-time | Request-response |
| **Best For** | Interactive applications | Batch processing |
| **Streaming** | ✅ Native support | ❌ Single response |
| **Latency** | Lower (persistent connection) | Higher (connection overhead) |
| **Use Case** | Chat applications, real-time tools | API integrations, scripts |

---

## 📖 **About This Service**

A powerful **Model Context Protocol (MCP) server** that provides intelligent RAG (Retrieval Augmented Generation) capabilities for Apple Developer Documentation. Built with TypeScript and deployed on Cloudflare Workers, this server enables AI agents to search and retrieve relevant Apple development content with advanced vector similarity and hybrid search strategies.

## 🚀 Features

### Core Capabilities
- **🔍 Intelligent RAG Queries** - Advanced document retrieval via API Gateway
- **🔄 Secure Proxy** - All requests proxied through authenticated API Gateway
- **⚡ High Performance** - Built on Cloudflare Workers with edge computing
- **🌐 Dual Transport** - Supports both SSE and HTTP MCP protocol connections
- **🔑 API Key Authentication** - User-controlled access through API keys

### Technical Highlights
- **🔗 API Gateway Integration** - Seamless integration with apple-rag.com API
- **🏗️ Modern Architecture** - TypeScript, async-first design, proxy pattern
- **🔒 Security First** - No sensitive data storage, user-controlled API keys
- **📈 Scalable** - Lightweight proxy design, global edge deployment

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│  Apple RAG MCP   │───▶│  API Gateway    │
│  (Claude, etc.) │    │   Proxy Server   │    │ (api.apple-rag  │
└─────────────────┘    └──────────────────┘    │     .com)       │
                                │              └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   API Key       │    │   RAG Service   │
                       │ Authentication  │    │   + Database    │
                       └─────────────────┘    └─────────────────┘
```

### Core Components
- **`AppleRAGMCP`** - Main MCP server class handling protocol communication
- **`ApiGatewayClient`** - HTTP client for proxying requests to API Gateway
- **Proxy Architecture** - No direct database access, all requests via API Gateway
- **API Key Authentication** - Secure authentication through apple-rag.com

### Cloudflare Workers Architecture
- **Lightweight Proxy** - Minimal resource usage, pure request forwarding
- **Global Edge Deployment** - Low latency worldwide through Cloudflare's network
- **Secure by Design** - No sensitive data stored, all authentication via API Gateway

## 🏠 **Self-Hosting (Optional)**

Want to run your own MCP proxy instance? Here's how:

### Prerequisites
- Node.js 18+ and npm
- Cloudflare account with Workers enabled
- Access to an Apple RAG API Gateway instance

### Local Development

```bash
# Clone and setup
git clone https://github.com/your-username/apple-rag-mcp.git
cd apple-rag-mcp
npm install

# No configuration needed - API Gateway URL is hardcoded

# Start development server
npm run dev
```

Your local server will be available at:
- **SSE endpoint**: `http://localhost:8787/sse`
- **HTTP endpoint**: `http://localhost:8787/mcp`

### Deploy Your Own Instance

[![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/your-username/apple-rag-mcp)

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## 📋 Prerequisites

### Required Services
1. **[Apple RAG API](https://apple-rag.com)** - API Gateway for RAG queries
2. **[Cloudflare Account](https://cloudflare.com)** - For Workers deployment (optional for local dev)

### System Requirements
- **Node.js** 18+
- **npm** or **yarn**
- **Git**

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/apple-rag-mcp.git
cd apple-rag-mcp
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configuration (Zero Configuration)
```bash
# No configuration needed!
# API Gateway URL is hardcoded to https://api.apple-rag.com
```

> ✅ **Zero Configuration**: No environment variables, no database credentials, no API keys needed! The MCP server acts as a secure proxy to the API Gateway.



## 🚀 Usage

### Development Server

```bash
# Start the development server
npm run dev

# The server will be available at:
# - SSE endpoint: http://localhost:8787/sse
# - MCP endpoint: http://localhost:8787/mcp
```

### Production Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

## 🔌 **Advanced MCP Client Integration**

### Multiple Client Support

Our service works with any MCP-compatible client:

#### Claude Desktop (Recommended)
```json
{
  "mcpServers": {
    "apple-rag": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.apple-rag.com/sse"]
    }
  }
}
```

#### Custom MCP Clients
```typescript
// Direct connection examples
const sseEndpoint = "https://mcp.apple-rag.com/sse";
const httpEndpoint = "https://mcp.apple-rag.com/mcp";

// Use your preferred MCP client library
```

#### Local Development Override
```json
{
  "mcpServers": {
    "apple-rag-local": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:8787/sse"]
    }
  }
}
```

### 💡 **Usage Examples**

#### Common Queries
```typescript
// SwiftUI Development
await callTool("perform_rag_query", {
  query: "SwiftUI navigation best practices",
  match_count: 3,
  api_key: "ak_live_your_key_here"
});

// UIKit Integration
await callTool("perform_rag_query", {
  query: "UIKit view controller lifecycle methods",
  match_count: 5,
  api_key: "ak_live_your_key_here"
});

// Core Data & CloudKit
await callTool("perform_rag_query", {
  query: "Core Data CloudKit synchronization",
  match_count: 4,
  api_key: "ak_live_your_key_here"
});

// iOS Performance
await callTool("perform_rag_query", {
  query: "iOS app performance optimization techniques",
  api_key: "ak_live_your_key_here"
});
```

#### Response Structure
Every query returns structured data with:
- **URL**: Direct link to Apple documentation
- **Content**: Relevant documentation excerpt
- **Similarity**: Relevance score (0.0 - 1.0)
- **Search Mode**: "hybrid" (vector + keyword search)

## 🔧 Configuration Options

### Zero Configuration Required

**No Environment Variables Needed**: The MCP server requires zero configuration:
- ✅ **API Gateway URL**: Hardcoded to `https://api.apple-rag.com`
- ✅ **No Secrets**: No API keys or database credentials stored
- ✅ **No Variables**: No environment variables required
- ✅ **Pure Proxy**: All authentication handled by API Gateway using user-provided API keys

**Deployment**: Simply deploy to Cloudflare Workers - no additional configuration needed!

### Search Modes

- **Vector Search** - Uses semantic similarity with Qwen 4B embeddings
- **Hybrid Search** - Combines vector similarity + keyword matching for better results
- **Keyword Search** - Traditional text-based search (fallback)

## 🧪 Development

### Project Structure
```
src/
├── index.ts              # Main MCP server entry point
└── api/
    └── client.ts         # API Gateway client for proxying requests
```

### Available Scripts
```bash
npm run dev          # Start development server
npm run deploy       # Deploy to Cloudflare Workers
npm run type-check   # TypeScript type checking
npm run format       # Format code with Biome
npm run lint:fix     # Fix linting issues
```

### Type Checking
```bash
npm run type-check
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Set up environment: `cp .dev.vars.example .dev.vars` and configure your credentials
4. Make your changes
5. Test locally: `npm run dev`
6. Add tests if applicable
7. Commit your changes: `git commit -m 'Add amazing feature'`
8. Push to the branch: `git push origin feature/amazing-feature`
9. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔒 Security

Please see [SECURITY.md](SECURITY.md) for information about reporting security vulnerabilities.

## 📚 Related Projects

- [Model Context Protocol](https://modelcontextprotocol.io/) - The MCP specification
- [Anthropic MCP SDK](https://github.com/anthropics/anthropic-sdk-typescript) - Official MCP SDK
- [Apple RAG API](https://apple-rag.com/) - RAG API Gateway service

## 🙏 Acknowledgments

- **Anthropic** for the Model Context Protocol specification
- **Cloudflare** for the Workers platform and agents framework
- **Apple RAG API** for providing the RAG service backend

---

**Built with ❤️ for the Apple Developer Community**
