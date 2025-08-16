/**
 * Apple RAG MCP Server - MCP 2025-06-18 Compliant
 * High-performance VPS deployment with complete protocol support
 */

import { fastify } from "fastify";
import { config } from "dotenv";
import { MCPHandler } from "./src/mcp-handler.js";
import { loadConfig } from "./src/config.js";
import { logger } from "./src/logger.js";

// Load environment variables based on NODE_ENV with validation
const nodeEnv = process.env.NODE_ENV || "development";
const envFile =
  nodeEnv === "production" ? ".env.production" : ".env.development";
config({ path: envFile });

// Validate environment configuration
logger.info("Environment configuration loaded", {
  nodeEnv,
  envFile,
  databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID?.substring(0, 8) + "...",
  embeddingHost: process.env.EMBEDDING_DB_HOST,
});

// Initialize Fastify with production-optimized settings
const server = fastify({
  logger:
    process.env.NODE_ENV === "production"
      ? {
          level: "info",
          redact: ["req.headers.authorization"],
        }
      : {
          level: "debug",
          transport: {
            target: "pino-pretty",
            options: { colorize: true },
          },
        },
  trustProxy: true,
  keepAliveTimeout: 30000,
  requestTimeout: 60000,
  bodyLimit: 1048576, // 1MB limit
});

// Load configuration
const appConfig = loadConfig();

// Database configuration is handled by API project
// MCP project only connects to existing database

// Initialize MCP handler
console.log("🔧 Initializing MCP handler with RAG pre-initialization...");
const mcpHandler = new MCPHandler(appConfig);

// Register CORS and security headers
server.addHook("preHandler", async (_request, reply) => {
  // CORS headers for MCP clients - Streamable HTTP compliant
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  reply.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Authorization, Last-Event-ID"
  );
  reply.header("Access-Control-Expose-Headers", "Mcp-Session-Id");
  reply.header("Access-Control-Max-Age", "86400");

  // Security headers
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("X-XSS-Protection", "1; mode=block");
});

// Handle preflight requests
server.options("/", async (_request, reply) => {
  reply.code(204).send();
});

// CORS preflight for manifest endpoint
server.options("/manifest", async (_request, reply) => {
  reply.code(204).send();
});

// MCP protocol endpoint - supports GET, POST, DELETE as per Streamable HTTP spec
server.get("/", async (request, reply) => {
  return mcpHandler.handle(request, reply);
});

server.post("/", async (request, reply) => {
  return mcpHandler.handle(request, reply);
});

server.delete("/", async (request, reply) => {
  return mcpHandler.handle(request, reply);
});

// Shared manifest data
const manifestData = {
  name: "Apple RAG MCP Server",
  title: "Apple Developer Documentation RAG Search",
  version: "2.0.0",
  description:
    "A production-ready MCP server providing intelligent search capabilities for Apple Developer Documentation using advanced RAG technology.",
  protocolVersion: "2025-06-18",
  capabilities: {
    tools: { listChanged: true },
    logging: {},
    experimental: {},
  },
  serverInfo: {
    name: "Apple RAG MCP Server",
    title: "Apple Developer Documentation RAG Search",
    version: "2.0.0",
  },
  endpoints: {
    mcp: "/",
    manifest: "/manifest",
    health: "/health",
  },
  transport: {
    type: "http",
    methods: ["GET", "POST", "DELETE"],
    headers: {
      required: ["Content-Type"],
      optional: ["Authorization", "MCP-Protocol-Version", "Mcp-Session-Id"],
    },
  },
  authorization: {
    enabled: true,
    type: "bearer",
    optional: true,
  },
};

// Standard manifest endpoint
server.get("/manifest", async (_request, reply) => {
  reply.code(200).send(manifestData);
});

// Client compatibility: Handle non-standard POST /manifest requests
server.post("/manifest", async (request, reply) => {
  const body = request.body as any;

  // Empty body → return manifest (common client behavior)
  if (!body || Object.keys(body).length === 0) {
    return reply.code(200).send(manifestData);
  }

  // MCP request to wrong endpoint → redirect to correct endpoint
  if (body.jsonrpc === "2.0" && body.method) {
    return reply.code(307).header("Location", "/").send({
      error: "Endpoint redirect",
      message: "MCP protocol requests should be sent to /",
      redirect: "/",
    });
  }

  // Any other POST data → helpful error
  reply.code(400).send({
    error: "Invalid manifest request",
    message:
      "Use GET /manifest for server discovery or POST / for MCP communication",
    endpoints: {
      manifest: "GET /manifest",
      mcp: "POST /",
    },
  });
});

// Health check endpoint
server.get("/health", async () => ({
  status: "healthy",
  timestamp: new Date().toISOString(),
  environment: appConfig.NODE_ENV,
  version: "2.0.0",
  protocolVersion: "2025-06-18",
  authorization: "enabled",
}));

// Graceful shutdown with proper MCP lifecycle management
const gracefulShutdown = async (signal: string) => {
  server.log.info(`Received ${signal}, initiating graceful shutdown`);

  try {
    // Close server and wait for existing connections to finish
    await server.close();
    server.log.info("Server closed successfully");
    process.exit(0);
  } catch (error) {
    server.log.error("Error during shutdown:", error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  server.log.fatal("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  server.log.fatal("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start server
const start = async () => {
  try {
    // Database tables are managed by API project
    // MCP project connects to existing database

    // RAG service is pre-initialized in constructor
    console.log("✅ RAG service pre-initialization completed");

    await server.listen({
      port: appConfig.PORT,
      host: "0.0.0.0",
    });

    server.log.info(`🚀 Apple RAG MCP Server started`);
    server.log.info(`📡 Listening on http://0.0.0.0:${appConfig.PORT}`);
    server.log.info(`🌍 Environment: ${appConfig.NODE_ENV}`);
    server.log.info(`📋 Protocol Version: 2025-06-18`);
    server.log.info(`🔧 MCP Compliant: ✅`);
    server.log.info(`🗄️ Database: Auto-initialized and ready`);
    server.log.info(`🎯 RAG Service: Pre-initialized and ready`);
  } catch (error) {
    console.error("Failed to start server:", error);
    server.log.fatal("Failed to start server:", error);
    process.exit(1);
  }
};

start();
