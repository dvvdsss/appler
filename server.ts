/**
 * Apple RAG MCP Server - MCP 2025-06-18 Compliant
 * High-performance VPS deployment with complete protocol support
 */

import { fastify } from 'fastify';
import { config } from 'dotenv';
import { MCPHandler } from './src/mcp-handler.js';
import { loadConfig } from './src/config.js';

// Load environment variables
config();

// Initialize Fastify with production-optimized settings
const server = fastify({
  logger: process.env.NODE_ENV === 'production' ? {
    level: 'info',
    redact: ['req.headers.authorization']
  } : {
    level: 'debug',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  },
  trustProxy: true,
  keepAliveTimeout: 30000,
  requestTimeout: 60000,
  bodyLimit: 1048576, // 1MB limit
});

// Load configuration
const appConfig = loadConfig();

// Determine base URL for OAuth metadata
const baseUrl = process.env.BASE_URL || `http://localhost:${appConfig.PORT}`;

// Initialize MCP handler with base URL for OAuth and API integration
const mcpHandler = new MCPHandler(appConfig, baseUrl);

// Register CORS and security headers
server.addHook('preHandler', async (_request, reply) => {
  // CORS headers for MCP clients - Streamable HTTP compliant
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Authorization, Last-Event-ID');
  reply.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  reply.header('Access-Control-Max-Age', '86400');

  // Security headers
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('X-XSS-Protection', '1; mode=block');
});

// Handle preflight requests
server.options('/', async (_request, reply) => {
  reply.code(204).send();
});

// CORS preflight for manifest endpoint
server.options('/manifest', async (_request, reply) => {
  reply.code(204).send();
});

// MCP protocol endpoint - supports GET, POST, DELETE as per Streamable HTTP spec
server.get('/', async (request, reply) => {
  return mcpHandler.handle(request, reply);
});

server.post('/', async (request, reply) => {
  return mcpHandler.handle(request, reply);
});

server.delete('/', async (request, reply) => {
  return mcpHandler.handle(request, reply);
});

// OAuth 2.1 Protected Resource Metadata endpoint (RFC9728)
server.get('/.well-known/oauth-protected-resource', async (_request, reply) => {
  const metadata = mcpHandler.getAuthMiddleware().getMetadataService().getProtectedResourceMetadata();
  reply.code(200).send(metadata);
});

// OAuth 2.1 Authorization Server Metadata endpoint (RFC8414)
server.get('/.well-known/oauth-authorization-server', async (_request, reply) => {
  const metadata = mcpHandler.getAuthMiddleware().getMetadataService().getAuthorizationServerMetadata();
  reply.code(200).send(metadata);
});

// OAuth endpoints (not implemented - tokens managed via apple-rag-api)
server.get('/oauth/authorize', async (_request, reply) => {
  reply.code(501).send({
    error: 'not_implemented',
    error_description: 'OAuth authorization is handled by apple-rag-api. Please use the web interface to manage tokens.'
  });
});

server.post('/oauth/token', async (_request, reply) => {
  reply.code(501).send({
    error: 'not_implemented',
    error_description: 'Token issuance is handled by apple-rag-api. Please use the web interface to create MCP tokens.'
  });
});

server.get('/oauth/jwks', async (_request, reply) => {
  reply.code(501).send({
    error: 'not_implemented',
    error_description: 'JWKS endpoint not available. MCP tokens are validated directly with Cloudflare.'
  });
});

server.post('/oauth/introspect', async (request, reply) => {
  const { token } = request.body as any;
  if (!token) {
    return reply.code(400).send({ error: 'invalid_request', error_description: 'Missing token parameter' });
  }

  const result = await mcpHandler.getAuthMiddleware().getTokenValidator().validateToken(token);
  reply.code(200).send({
    active: result.valid,
    scope: result.claims?.scope,
    client_id: result.claims?.client_id,
    username: result.claims?.sub,
    exp: result.claims?.exp,
    iat: result.claims?.iat,
    sub: result.claims?.sub,
    aud: result.claims?.aud,
    iss: result.claims?.iss,
    jti: result.claims?.jti
  });
});

server.post('/oauth/revoke', async (request, reply) => {
  const { token } = request.body as any;
  if (!token) {
    return reply.code(400).send({ error: 'invalid_request', error_description: 'Missing token parameter' });
  }

  const success = await mcpHandler.getAuthMiddleware().getTokenValidator().revokeToken(token);
  reply.code(success ? 200 : 400).send(success ? {} : { error: 'invalid_token' });
});

// Token management endpoints (handled by apple-rag-api)
server.post('/tokens', async (_request, reply) => {
  reply.code(501).send({
    error: 'not_implemented',
    error_description: 'Token management is handled by apple-rag-api. Please use the web interface.'
  });
});

server.get('/tokens', async (_request, reply) => {
  reply.code(501).send({
    error: 'not_implemented',
    error_description: 'Token listing is handled by apple-rag-api. Please use the web interface.'
  });
});

// Shared manifest data
const manifestData = {
  name: 'Apple RAG MCP Server',
  title: 'Apple Developer Documentation RAG Search',
  version: '2.0.0',
  description: 'A production-ready MCP server providing intelligent search capabilities for Apple Developer Documentation using advanced RAG technology.',
  protocolVersion: '2025-06-18',
  capabilities: {
    tools: { listChanged: true },
    logging: {},
    experimental: {}
  },
  serverInfo: {
    name: 'Apple RAG MCP Server',
    title: 'Apple Developer Documentation RAG Search',
    version: '2.0.0'
  },
  endpoints: {
    mcp: '/',
    manifest: '/manifest',
    health: '/health',
    oauth: {
      authorize: '/oauth/authorize',
      token: '/oauth/token',
      introspect: '/oauth/introspect',
      jwks: '/oauth/jwks'
    },
    wellKnown: {
      oauthProtectedResource: '/.well-known/oauth-protected-resource',
      oauthAuthorizationServer: '/.well-known/oauth-authorization-server'
    }
  },
  transport: {
    type: 'http',
    methods: ['GET', 'POST', 'DELETE'],
    headers: {
      required: ['Content-Type'],
      optional: ['Authorization', 'MCP-Protocol-Version', 'Mcp-Session-Id']
    }
  },
  authorization: {
    enabled: true,
    type: 'oauth2.1',
    optional: true,
    scopes: ['mcp:read', 'mcp:write', 'mcp:admin']
  }
};

// Standard manifest endpoint
server.get('/manifest', async (_request, reply) => {
  reply.code(200).send(manifestData);
});

// Client compatibility: Handle non-standard POST /manifest requests
server.post('/manifest', async (request, reply) => {
  const body = request.body as any;

  // Empty body → return manifest (common client behavior)
  if (!body || Object.keys(body).length === 0) {
    return reply.code(200).send(manifestData);
  }

  // MCP request to wrong endpoint → redirect to correct endpoint
  if (body.jsonrpc === '2.0' && body.method) {
    return reply.code(307).header('Location', '/').send({
      error: 'Endpoint redirect',
      message: 'MCP protocol requests should be sent to /',
      redirect: '/'
    });
  }

  // Any other POST data → helpful error
  reply.code(400).send({
    error: 'Invalid manifest request',
    message: 'Use GET /manifest for server discovery or POST / for MCP communication',
    endpoints: {
      manifest: 'GET /manifest',
      mcp: 'POST /'
    }
  });
});

// Health check endpoint
server.get('/health', async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  environment: appConfig.NODE_ENV,
  version: '2.0.0',
  protocolVersion: '2025-06-18',
  authorization: 'enabled'
}));

// Graceful shutdown with proper MCP lifecycle management
const gracefulShutdown = async (signal: string) => {
  server.log.info(`Received ${signal}, initiating graceful shutdown`);

  try {
    // Close server and wait for existing connections to finish
    await server.close();
    server.log.info('Server closed successfully');
    process.exit(0);
  } catch (error) {
    server.log.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  server.log.fatal('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  server.log.fatal('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const start = async () => {
  try {
    await server.listen({
      port: appConfig.PORT,
      host: '0.0.0.0'
    });

    server.log.info(`🚀 Apple RAG MCP Server started`);
    server.log.info(`📡 Listening on http://0.0.0.0:${appConfig.PORT}`);
    server.log.info(`🌍 Environment: ${appConfig.NODE_ENV}`);
    server.log.info(`📋 Protocol Version: 2025-06-18`);
    server.log.info(`🔧 MCP Compliant: ✅`);
  } catch (error) {
    console.error('Failed to start server:', error);
    server.log.fatal('Failed to start server:', error);
    process.exit(1);
  }
};

start();
