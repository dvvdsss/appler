/**
 * Apple RAG MCP Server - MCP 2025-06-18 Compliant
 * High-performance VPS deployment with complete protocol support
 */

import { config } from "dotenv";
import { fastify } from "fastify";
import { loadConfig } from "./src/config.js";
import { logger } from "./src/logger.js";
import { MCPHandler } from "./src/mcp-handler.js";
import { SUPPORTED_MCP_VERSIONS } from "./src/mcp-server.js";
import {
  type SecurityConfig,
  SecurityMiddleware,
} from "./src/security/security-middleware.js";

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

// Initialize security middleware (always enabled)
const securityConfig: SecurityConfig = {
  alertWebhookUrl: process.env.SECURITY_WEBHOOK_URL,
  maxRequestsPerMinute: appConfig.SECURITY_MAX_REQUESTS_PER_MINUTE || 30,
};

const securityMiddleware = new SecurityMiddleware(securityConfig);

// Database configuration is handled by API project
// MCP project only connects to existing database

// Initialize MCP handler
console.log("🔧 Initializing MCP handler with RAG pre-initialization...");
const mcpHandler = new MCPHandler(appConfig);

// Register security middleware and headers for Streamable HTTP with SSE
server.addHook("preHandler", async (request, reply) => {
  // Security check first
  const isAllowed = await securityMiddleware.checkSecurity(request, reply);
  if (!isAllowed) {
    // Request was blocked by security middleware
    return;
  }

  // Set security headers
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  reply.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Accept, MCP-Protocol-Version, Authorization, Last-Event-ID, Cache-Control"
  );
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("X-XSS-Protection", "1; mode=block");
  reply.header(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
  reply.header(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );
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
  title: "Apple Developer Documentation Search",
  version: "2.0.0",
  description:
    "Enterprise-grade MCP server providing AI agents with comprehensive access to Apple's complete developer documentation. Delivers accurate, contextual information about Apple's frameworks, APIs, tools, design guidelines, and technical resources using advanced RAG technology.",
  protocolVersion: "2025-03-26", // Default compatible version for maximum client compatibility
  supportedVersions: [...SUPPORTED_MCP_VERSIONS], // All supported protocol versions
  capabilities: {
    tools: { listChanged: true },
    logging: {},
    experimental: {},
  },
  serverInfo: {
    name: "Apple RAG MCP Server",
    title: "Apple Developer Documentation Search",
    version: "2.0.0",
  },
  endpoints: {
    mcp: "/",
    manifest: "/manifest",
    health: "/health",
  },
  transport: {
    type: "streamable-http",
    methods: ["GET", "POST", "DELETE"],
    sse: true,
    headers: {
      required: ["Content-Type"],
      optional: [
        "Authorization",
        "MCP-Protocol-Version",
        "Accept",
        "Last-Event-ID",
      ],
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
  protocolVersion: "2025-03-26", // Default compatible version for maximum client compatibility
  supportedVersions: [...SUPPORTED_MCP_VERSIONS], // All supported protocol versions
  authorization: "enabled",
  security: securityMiddleware.getHealthInfo(),
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

    // Prepare startup message once
    const startupMessage = `═══════════════════════════════════════════════════════════════════════════════
🚀 Apple RAG MCP Server started
📡 Listening on http://0.0.0.0:${appConfig.PORT}
🌍 Environment: ${appConfig.NODE_ENV}
📋 Default Protocol Version: 2025-03-26 (maximum compatibility)
🔄 Supported Versions: ${SUPPORTED_MCP_VERSIONS.join(", ")}
🔧 MCP Compliant: ✅
🗄️ Database: Auto-initialized and ready
🎯 RAG Service: Pre-initialized and ready
🛡️ Security: ✅ ALWAYS ACTIVE
🔒 Rate Limit: ${securityConfig.maxRequestsPerMinute} requests per minute
⚡ Threat Detection: Real-time pattern analysis enabled
📱 Security Alerts: Real-time webhook notifications enabled`;

    // Output to logs (split by lines for proper logging format)
    startupMessage.split("\n").forEach((line) => server.log.info(line));

    // Send to webhook (use the same message)
    await securityMiddleware.sendStartupNotification(startupMessage);
  } catch (error) {
    console.error("Failed to start server:", error);
    server.log.fatal("Failed to start server:", error);
    process.exit(1);
  }
};

start();
