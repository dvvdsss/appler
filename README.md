# Apple RAG MCP Server - Extreme Simplicity

A production-ready, high-performance MCP (Model Context Protocol) server that provides intelligent search capabilities for Apple Developer Documentation using advanced RAG (Retrieval-Augmented Generation) technology. **Fully compliant with MCP 2025-06-18 specification with ultra-simple Cloudflare D1 authentication.**

## 🌟 Key Features

- **📋 Complete MCP 2025-06-18 Compliance**: Full implementation of all MCP specifications
- **🔐 OAuth 2.1 Authorization**: Complete RFC9728 Protected Resource Metadata and RFC8414 Authorization Server Metadata
- **🔄 Optional Authentication**: Works with or without access tokens - maximum flexibility
- **🎯 Session Management**: Complete session lifecycle with `Mcp-Session-Id` headers
- **🚀 VPS Optimized**: High-performance Node.js deployment with no CPU limitations
- **🔍 Intelligent Search**: Advanced vector search with semantic understanding
- **⚡ Production Ready**: Built-in session management, error handling, and monitoring
- **📊 Comprehensive**: Full Apple Developer Documentation coverage
- **🏗️ Modern Architecture**: TypeScript, Fastify, PostgreSQL + pgvector
- **🛡️ Enterprise Security**: Complete OAuth 2.1, CORS, input validation, and security headers

## 🎯 MCP 2025-06-18 Full Compliance

### Streamable HTTP Transport
- ✅ **GET Endpoint**: Proper handling with SSE Accept header validation (returns 405 - SSE not supported)
- ✅ **POST Endpoint**: Full JSON-RPC request/response and notification handling
- ✅ **DELETE Endpoint**: Session termination support
- ✅ **Session Management**: `Mcp-Session-Id` header support with session lifecycle
- ✅ **Accept Header Validation**: Proper `application/json` and `text/event-stream` handling
- ✅ **Protocol Version Headers**: `MCP-Protocol-Version` header support
- ✅ **Status Codes**: Correct HTTP status mapping (202 for notifications, etc.)
- ✅ **CORS Headers**: Complete CORS support with proper header exposure

### OAuth 2.1 Authorization
- ✅ **Protected Resource Metadata (RFC9728)**: `/.well-known/oauth-protected-resource`
- ✅ **Authorization Server Metadata (RFC8414)**: `/.well-known/oauth-authorization-server`
- ✅ **Bearer Token Support**: `Authorization: Bearer <token>` header validation
- ✅ **WWW-Authenticate Headers**: Proper 401 responses with resource metadata URLs
- ✅ **Token Introspection (RFC7662)**: `/oauth/introspect` endpoint
- ✅ **Token Revocation (RFC7009)**: `/oauth/revoke` endpoint
- ✅ **PKCE Support**: S256 code challenge method
- ✅ **Resource Indicators (RFC8707)**: Resource parameter validation
- ✅ **Scope-based Access Control**: `mcp:read`, `mcp:write`, `mcp:admin` scopes

### Security Best Practices
- ✅ **Session Hijacking Prevention**: User-session binding with mismatch detection
- ✅ **Token Passthrough Prevention**: Strict audience and issuer validation
- ✅ **Session Expiration**: Automatic cleanup of expired sessions (24h max age, 2h inactivity)
- ✅ **Suspicious Token Detection**: Pattern-based security validation
- ✅ **Audit Logging**: Comprehensive security event logging with IP tracking
- ✅ **No Session Authentication**: Sessions used only for state, not authentication
- ✅ **Secure Session IDs**: Cryptographically secure UUID generation
- ✅ **Optional Authentication Preserved**: Full functionality without tokens

### Cancellation Support
- ✅ **Request Tracking**: Complete lifecycle tracking of all active requests
- ✅ **Real Cancellation**: Actual request termination using AbortController
- ✅ **Race Condition Protection**: Safe handling of cancellation vs response timing
- ✅ **Security Validation**: User/session verification for cancellation requests
- ✅ **Initialize Protection**: Prevent cancellation of initialize requests
- ✅ **Graceful Handling**: Proper cleanup and error handling for cancelled requests
- ✅ **Long-running Support**: Cancellation of time-intensive operations (RAG queries)
- ✅ **Invalid Request Handling**: Graceful handling of unknown/completed request cancellations

### Ping Support
- ✅ **Basic Ping Method**: Standard `ping` request with empty `{}` response
- ✅ **Connection Health Tracking**: Real-time monitoring of session connection status
- ✅ **Latency Measurement**: Automatic calculation of ping response times
- ✅ **Active Monitoring**: Server-initiated connection health checks (configurable)
- ✅ **Session Binding**: Ping metrics tied to specific sessions and users
- ✅ **Automatic Cleanup**: Inactive session detection and termination
- ✅ **Configurable Intervals**: Customizable ping frequency and timeout settings
- ✅ **Health Diagnostics**: Comprehensive connection health reporting and logging

### Progress Support
- ✅ **Progress Token Parsing**: Extract and validate `_meta.progressToken` from requests
- ✅ **Progress Notifications**: Standard `notifications/progress` with token, progress, total, message
- ✅ **Multi-phase Tracking**: RAG queries with detailed progress phases (validation, database, search, processing)
- ✅ **Admin Stats Progress**: Progress tracking for administrative statistics generation
- ✅ **Token Validation**: Support for string and number progress tokens with uniqueness validation
- ✅ **Rate Limiting**: Configurable minimum intervals between progress updates
- ✅ **Monotonic Progress**: Ensures progress values only increase, never decrease
- ✅ **Automatic Cleanup**: Progress state cleanup after completion with configurable delays

## 🛠 Quick Start

### Prerequisites

- **Node.js 18+**
- **PostgreSQL with pgvector extension**
- **SiliconFlow API key**
- **VPS or local server**

### Installation

1. **Clone and setup**
   ```bash
   git clone <repository-url>
   cd apple-rag-mcp
   pnpm install  # or npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build and deploy**
   ```bash
   pnpm build
   pnpm start:prod
   ```

## 🔐 Authentication & Authorization

### Optional Authentication
The server supports **optional authentication** - you can use it with or without access tokens:

- **Without Token**: Full access to basic query functionality
- **With Token**: Enhanced features and admin tools (if authorized)

### Demo Tokens
For testing, the server provides demo tokens:

```bash
# Generate a demo token
curl -X POST http://localhost:3001/demo/generate-token \
  -H "Content-Type: application/json" \
  -d '{"subject": "user@example.com", "scopes": ["mcp:read", "mcp:write"]}'

# Use the token
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "MCP-Protocol-Version: 2025-06-18" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

### Pre-configured Demo Tokens
- **Admin Token**: `demo-admin-token-12345` (scope: `mcp:admin`)
- **Read-only Token**: `demo-readonly-token-67890` (scope: `mcp:read`)

## 🧪 Testing Compliance

Test the server's complete MCP 2025-06-18 compliance and security:

```bash
# Test MCP Progress compliance
node test-progress.js

# Test MCP Ping compliance
node test-ping.js

# Test MCP Cancellation compliance
node test-cancellation.js

# Test Security Best Practices compliance
node test-security.js

# Test OAuth 2.1 Authorization compliance
node test-authorization.js

# Test Streamable HTTP transport compliance
node test-streamable-http.js

# Test basic MCP protocol compliance
node test-basic-mcp.js

# Run all tests
pnpm test:all
```

### Test Results

- ✅ **Progress Tests**: 5/5 passed
- ✅ **Ping Tests**: 5/5 passed
- ✅ **Cancellation Tests**: 5/5 passed
- ✅ **Security Tests**: 5/5 passed
- ✅ **Authorization Tests**: 6/6 passed
- ✅ **Streamable HTTP Tests**: 6/6 passed
- ✅ **Basic MCP Tests**: 3/3 passed
- ✅ **Total**: 35/35 passed

## 🎉 Production-ready MCP server with complete MCP 2025-06-18 compliance and security!
