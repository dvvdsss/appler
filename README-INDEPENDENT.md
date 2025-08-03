# Apple RAG MCP Server - VPS Edition

Modern, high-performance MCP server with built-in RAG capabilities for Apple Developer Documentation, optimized for VPS deployment.

## 🚀 Features

- **VPS Optimized**: No CPU time limits, full Node.js compatibility
- **Built-in RAG**: Direct PostgreSQL + pgvector integration
- **Modern Architecture**: TypeScript + Fastify + PM2 cluster
- **MCP 2025-06-18 Compliant**: Full protocol support
- **High Performance**: Vector search with SiliconFlow embeddings
- **Production Ready**: Comprehensive error handling and logging
- **Package Manager**: Modern pnpm for faster, more reliable builds

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         VPS MCP Server                  │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │   RAG       │  │   Embedding     │  │
│  │  Service    │  │   Service       │  │
│  └─────────────┘  └─────────────────┘  │
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  Database   │  │   Search        │  │
│  │  Service    │  │   Engine        │  │
│  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│   PostgreSQL    │  │   SiliconFlow   │
│   + pgvector    │  │   Embedding     │
│                 │  │     API         │
└─────────────────┘  └─────────────────┘
```

## 📋 Prerequisites

1. **VPS Server** with Node.js 18+
2. **PostgreSQL Database** with pgvector extension
3. **SiliconFlow API Key** for embedding generation
4. **pnpm** package manager

## 🔧 Environment Variables

Create `.env` file with these variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Database Configuration
EMBEDDING_DB_HOST=your-postgres-host
EMBEDDING_DB_PORT=5432
EMBEDDING_DB_DATABASE=your-database-name
EMBEDDING_DB_USER=your-username
EMBEDDING_DB_PASSWORD=your-password
EMBEDDING_DB_SSLMODE=disable

# API Configuration
SILICONFLOW_API_KEY=your-siliconflow-api-key
SILICONFLOW_TIMEOUT=30

# Feature Flags
USE_HYBRID_SEARCH=false
```

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build and start:**
   ```bash
   pnpm build
   pnpm start
   ```

4. **Or use PM2 for production:**
   ```bash
   pnpm start:prod
   ```

## 🔍 Usage

The server provides a single `query` tool for searching Apple Developer Documentation:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "query",
    "arguments": {
      "query": "SwiftUI navigation",
      "match_count": 5
    }
  }
}
```

## 🎯 Performance

- **Vector Search**: Sub-100ms response times
- **Embedding Generation**: ~200ms via SiliconFlow
- **Memory Usage**: <50MB per request
- **Concurrent Connections**: Up to 6 per request

## 🔒 Security

- Bearer token authentication
- Anonymous access with rate limiting
- Input validation and sanitization
- Secure database connections

## 📊 Monitoring

Built-in observability with:
- Structured logging
- Performance metrics
- Error tracking
- Request tracing

## 🛠️ Development

```bash
# Start development server
pnpm run dev

# Deploy to production
pnpm run deploy
```

## 📝 License

MIT License - see LICENSE file for details.
