/**
 * Apple RAG MCP Server - Modern VPS Deployment
 * Optimized for high-performance Node.js environment
 */

import { fastify } from 'fastify';
import { config } from 'dotenv';
import { MCPHandler } from './src/mcp-handler.js';
import { loadConfig } from './src/config.js';

// Load environment variables
config();

// Initialize Fastify with optimal settings
const server = fastify({
  logger: process.env.NODE_ENV === 'production' ? {
    level: 'info'
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
});

// Load configuration
const appConfig = loadConfig();

// Initialize MCP handler
const mcpHandler = new MCPHandler(appConfig);

// Register routes
server.post('/', async (request, reply) => {
  return mcpHandler.handle(request, reply);
});

// Health check endpoint
server.get('/health', async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  environment: appConfig.NODE_ENV,
  version: '2.0.0'
}));

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  server.log.info(`Received ${signal}, shutting down gracefully`);
  try {
    await server.close();
    process.exit(0);
  } catch (error) {
    server.log.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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
  } catch (error) {
    console.error('❌ Failed to start server:');
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    server.log.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
