# Apple RAG MCP Server

A Model Context Protocol (MCP) server for Apple RAG functionality.

## Current Status: Hello World Version

This is a minimal Hello World implementation of the MCP server, designed to be immediately usable for testing MCP connections.

## Features

- ✅ Complete MCP 2025-03-26 protocol implementation
- ✅ HTTP JSON-RPC and Server-Sent Events support
- ✅ Smart protocol detection based on Accept headers
- ✅ Full CORS support for web clients
- ✅ No authentication required (for testing)
- ✅ Hello world tool for basic functionality testing

## Quick Start

### Development
```bash
npm run dev
```

### Deploy to Cloudflare Workers
```bash
npm run deploy
```

### Deploy to Production (with custom domain)
```bash
npm run deploy:prod
```

## MCP Client Configuration

### Default Worker URL
```
MCP Server URL: https://apple-rag-mcp.bingow.workers.dev
Authentication: No Authentication Required
```

### Production URL (after deployment)
```
MCP Server URL: https://mcp.apple-rag.com
Authentication: No Authentication Required
```

## Available Tools

### hello
- **Description**: Say hello to someone
- **Input**: `name` (string, required)
- **Output**: Personalized greeting message

## API Endpoints

- `/` - Main MCP endpoint (smart protocol detection)
- `/mcp` - Dedicated MCP endpoint
- `/sse` - Server-Sent Events endpoint
- `/manifest` - Service discovery endpoint

## Development Roadmap

1. ✅ **Phase 1**: Hello World MCP Server (Current)
2. 🔄 **Phase 2**: Add RAG query functionality
3. 🔄 **Phase 3**: Integrate with Apple RAG API
4. 🔄 **Phase 4**: Add authentication and security
5. 🔄 **Phase 5**: Production optimizations

## Testing

Test the server with curl:

```bash
# Test server info
curl https://apple-rag-mcp.bingow.workers.dev/

# Test tools list
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  https://apple-rag-mcp.bingow.workers.dev/

# Test hello tool
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"hello","arguments":{"name":"World"}}}' \
  https://apple-rag-mcp.bingow.workers.dev/
```
