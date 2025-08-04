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

// Initialize MCP handler with base URL for OAuth
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

// OAuth endpoints (simplified implementation for demo)
server.get('/oauth/authorize', async (_request, reply) => {
  reply.code(501).send({
    error: 'not_implemented',
    error_description: 'Authorization endpoint not implemented in this demo. Use demo tokens for testing.'
  });
});

server.post('/oauth/token', async (_request, reply) => {
  reply.code(501).send({
    error: 'not_implemented',
    error_description: 'Token endpoint not implemented in this demo. Use demo tokens for testing.'
  });
});

server.get('/oauth/jwks', async (_request, reply) => {
  reply.code(501).send({
    error: 'not_implemented',
    error_description: 'JWKS endpoint not implemented in this demo.'
  });
});

server.post('/oauth/introspect', async (request, reply) => {
  const { token } = request.body as any;
  if (!token) {
    return reply.code(400).send({ error: 'invalid_request', error_description: 'Missing token parameter' });
  }

  const result = await mcpHandler.getAuthMiddleware().getTokenValidator().introspectToken(token);
  reply.code(200).send(result);
});

server.post('/oauth/revoke', async (request, reply) => {
  const { token } = request.body as any;
  if (!token) {
    return reply.code(400).send({ error: 'invalid_request', error_description: 'Missing token parameter' });
  }

  const success = await mcpHandler.getAuthMiddleware().getTokenValidator().revokeToken(token);
  reply.code(success ? 200 : 400).send(success ? {} : { error: 'invalid_token' });
});

// Demo token generation endpoint (for testing only)
server.post('/demo/generate-token', async (request, reply) => {
  const { subject, scopes } = request.body as any;
  if (!subject || !scopes) {
    return reply.code(400).send({ error: 'Missing subject or scopes' });
  }

  const token = mcpHandler.getAuthMiddleware().getTokenValidator().generateDemoToken(subject, scopes);
  reply.code(200).send({ access_token: token, token_type: 'Bearer', expires_in: 3600 });
});

// MCP Manifest endpoint - for client discovery
server.get('/manifest', async (_request, reply) => {
  const manifest = {
    name: 'Apple RAG MCP Server',
    title: 'Apple Developer Documentation RAG Search',
    version: '2.0.0',
    description: 'A production-ready MCP server providing intelligent search capabilities for Apple Developer Documentation using advanced RAG technology.',
    protocolVersion: '2025-06-18',
    capabilities: {
      tools: {
        listChanged: true
      },
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

  reply.code(200).send(manifest);
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
    server.log.fatal('Failed to start server:', error);
    process.exit(1);
  }
};

start();
