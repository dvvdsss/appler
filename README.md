# Apple RAG MCP Server

🎉 **FREE Apple Developer Documentation RAG Service** - Ready to use instantly!

## 🚀 **Quick Start - Use Our Free Service**

**No setup required!** Connect directly to our hosted Apple RAG MCP service:

### 🔗 **Available Endpoints**

| Protocol | Endpoint | Best For |
|----------|----------|----------|
| **SSE** | `https://appleragmcp.com/sse` | Real-time applications, streaming |
| **HTTP** | `https://appleragmcp.com/mcp` | Standard MCP clients, batch queries |

### ⚡ **Instant Configuration**

#### For Claude Desktop
Add this to your MCP configuration file:

```json
{
  "mcpServers": {
    "apple-rag": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://appleragmcp.com/sse"
      ]
    }
  }
}
```

#### For Other MCP Clients
- **SSE Connection**: `https://appleragmcp.com/sse`
- **HTTP Connection**: `https://appleragmcp.com/mcp`

### 🧪 **Test It Now**

```bash
# Test the service instantly
curl -H "Accept: text/event-stream" https://appleragmcp.com/sse

# Or test the health endpoint
curl https://appleragmcp.com/health

# Test a RAG query (requires MCP client)
# Example query: "SwiftUI navigation best practices"
```

### 🛠️ **Available Tools**

Once connected, you can use the `perform_rag_query` tool:

```typescript
// Query Apple Developer Documentation
await callTool("perform_rag_query", {
  query: "How to implement SwiftUI navigation",
  match_count: 3  // Optional: number of results (default: 5)
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
- **🔍 Intelligent RAG Queries** - Advanced document retrieval with semantic search
- **🔄 Hybrid Search** - Combines vector similarity and keyword matching for optimal results
- **⚡ High Performance** - Built on Cloudflare Workers with edge computing
- **🌐 Dual Transport** - Supports both SSE and HTTP MCP protocol connections
- **📊 Vector Database** - NEON PostgreSQL with pgvector for efficient similarity search

### Technical Highlights
- **🤖 Qwen 4B Embeddings** - Powered by SiliconFlow API for high-quality embeddings
- **🏗️ Modern Architecture** - TypeScript, async-first design, modular structure
- **🔒 Security First** - Environment-based configuration, no hardcoded credentials
- **📈 Scalable** - Cloud-native design with lazy loading and connection pooling

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │───▶│  Apple RAG MCP   │───▶│  NEON Database  │
│  (Claude, etc.) │    │     Server       │    │   (pgvector)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  SiliconFlow API │
                       │ (Qwen Embedding) │
                       └──────────────────┘
```

### Core Components
- **`AppleRAGMCP`** - Main MCP server class with RAG tools (Durable Object)
- **`RAGService`** - Core RAG query processing and orchestration (per-instance)
- **`HybridSearchEngine`** - Advanced search combining vector + keyword strategies
- **`NEONClient`** - PostgreSQL client with pgvector support (isolated per DO)
- **`SiliconFlowEmbedding`** - Embedding generation service

### Cloudflare Workers Architecture
- **Durable Object Isolation** - Each MCP session runs in an isolated Durable Object instance
- **Per-Instance RAG Services** - Each DO instance maintains its own RAG service and database connections
- **I/O Optimization** - Follows Cloudflare's performance guidelines by avoiding cross-instance I/O sharing

## 🏠 **Self-Hosting (Optional)**

Want to run your own instance? Here's how:

### Local Development

```bash
# Clone and setup
git clone https://github.com/your-username/apple-rag-mcp.git
cd apple-rag-mcp
npm install

# Configure environment
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your API keys (see configuration section below)

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
1. **[NEON Database](https://neon.tech)** - PostgreSQL with pgvector extension
2. **[SiliconFlow API](https://siliconflow.cn)** - For Qwen embedding generation
3. **[Cloudflare Account](https://cloudflare.com)** - For Workers deployment (optional for local dev)

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

### 3. Environment Configuration (Cloudflare Workers Standard)
```bash
# Copy the example environment file
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` with your actual credentials:

```bash
# SiliconFlow API Configuration (Required)
SILICONFLOW_API_KEY=sk-your-actual-api-key-here

# NEON Database Configuration (Required)
NEON_HOST=your-neon-host.neon.tech
NEON_DATABASE=your-database-name
NEON_USER=your-database-user
NEON_PASSWORD=your-database-password

# Search Configuration
USE_HYBRID_SEARCH=true
```

> ⚠️ **Cloudflare Standard**: Use `.dev.vars` for local development. For production, configure these in Cloudflare Dashboard. Never commit `.dev.vars` - it's already in `.gitignore`.

### 4. Database Setup

Your NEON database needs the `pgvector` extension and a `chunks` table:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create chunks table for document storage
CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(2560),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient searches
CREATE INDEX IF NOT EXISTS idx_chunks_url ON chunks(url);
```

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
      "args": ["mcp-remote", "https://appleragmcp.com/sse"]
    }
  }
}
```

#### Custom MCP Clients
```typescript
// Direct connection examples
const sseEndpoint = "https://appleragmcp.com/sse";
const httpEndpoint = "https://appleragmcp.com/mcp";

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
  match_count: 3
});

// UIKit Integration
await callTool("perform_rag_query", {
  query: "UIKit view controller lifecycle methods",
  match_count: 5
});

// Core Data & CloudKit
await callTool("perform_rag_query", {
  query: "Core Data CloudKit synchronization",
  match_count: 4
});

// iOS Performance
await callTool("perform_rag_query", {
  query: "iOS app performance optimization techniques"
});
```

#### Response Structure
Every query returns structured data with:
- **URL**: Direct link to Apple documentation
- **Content**: Relevant documentation excerpt
- **Similarity**: Relevance score (0.0 - 1.0)
- **Search Mode**: "hybrid" (vector + keyword search)

## 🔧 Configuration Options

### Environment Variables (Cloudflare Workers Standard)

**Local Development** (`.dev.vars` file):
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SILICONFLOW_API_KEY` | ✅ | - | SiliconFlow API key for embeddings |
| `NEON_HOST` | ✅ | - | NEON database host |
| `NEON_DATABASE` | ✅ | - | Database name |
| `NEON_USER` | ✅ | - | Database user |
| `NEON_PASSWORD` | ✅ | - | Database password |
| `NEON_PORT` | ❌ | `5432` | Database port |
| `USE_HYBRID_SEARCH` | ❌ | `true` | Enable hybrid search |
| `SILICONFLOW_TIMEOUT` | ❌ | `30` | API timeout in seconds |

**Production Deployment**: Configure the same variables in Cloudflare Dashboard → Workers → Your Worker → Settings → Environment Variables.

### Search Modes

- **Vector Search** - Uses semantic similarity with Qwen 4B embeddings
- **Hybrid Search** - Combines vector similarity + keyword matching for better results
- **Keyword Search** - Traditional text-based search (fallback)

## 🧪 Development

### Project Structure
```
src/
├── index.ts              # Main MCP server entry point
├── database/
│   ├── config.ts         # NEON database configuration
│   └── client.ts         # PostgreSQL client with pgvector
├── embedding/
│   └── siliconflow.ts    # SiliconFlow API integration
├── search/
│   └── hybrid.ts         # Hybrid search engine
└── rag/
    └── service.ts        # Core RAG service
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
- [NEON Database](https://neon.tech/) - Serverless PostgreSQL
- [SiliconFlow](https://siliconflow.cn/) - AI model API platform

## 🙏 Acknowledgments

- **Anthropic** for the Model Context Protocol specification
- **Cloudflare** for the Workers platform and agents framework
- **NEON** for serverless PostgreSQL with pgvector
- **SiliconFlow** for providing Qwen model APIs

---

**Built with ❤️ for the Apple Developer Community**
