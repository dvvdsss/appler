/**
 * Modern MCP Streamable HTTP Handler - Main Controller
 * Fully compliant with MCP 2025-06-18 Streamable HTTP specification
 * Supports Server-Sent Events for streaming responses
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { type AuthContext, AuthMiddleware } from "./auth/auth-middleware.js";
import { logger } from "./logger.js";
import {
  APP_CONSTANTS,
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
  type MCPNotification,
  type MCPRequest,
  type MCPResponse,
  MCPServer,
  SUPPORTED_MCP_VERSIONS,
} from "./mcp-server.js";
import { D1Connector } from "./services/d1-connector.js";
import { RAGService } from "./services/rag-service.js";
import { RateLimitService } from "./services/rate-limit-service.js";
import { ToolCallLogger } from "./services/tool-call-logger.js";
import type { AppConfig } from "./types/env.js";

export class MCPHandler {
  private ragService: RAGService;
  private authMiddleware: AuthMiddleware;
  private mcpServer: MCPServer;
  private clientInitialized = false; // Track if client sent initialized notification

  constructor(config: AppConfig) {
    this.ragService = new RAGService(config);

    // Create Cloudflare D1 configuration
    const d1Config = {
      accountId: config.CLOUDFLARE_ACCOUNT_ID,
      apiToken: config.CLOUDFLARE_API_TOKEN,
      databaseId: config.CLOUDFLARE_D1_DATABASE_ID,
    };

    // Initialize services
    const d1Connector = new D1Connector(d1Config);
    const rateLimitService = new RateLimitService(d1Connector, d1Config);
    const toolCallLogger = new ToolCallLogger(d1Config);

    // Initialize authentication middleware
    this.authMiddleware = new AuthMiddleware(d1Config);

    // Initialize MCP server
    this.mcpServer = new MCPServer(
      this.ragService,
      rateLimitService,
      toolCallLogger
    );

    // Pre-initialize RAG service for optimal performance
    this.preInitializeRAGService();

    logger.info("MCP Handler initialized", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      streamableHTTP: true,
      sseSupport: true,
    });
  }

  /**
   * Pre-initialize RAG service for better performance
   */
  private async preInitializeRAGService(): Promise<void> {
    try {
      await this.ragService.initialize();
      logger.info("RAG service pre-initialized successfully");
    } catch (error) {
      logger.error("Failed to pre-initialize RAG service", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle MCP Streamable HTTP requests with SSE support
   */
  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const startTime = Date.now();

    try {
      // Handle MCP-Protocol-Version header with backwards compatibility
      const protocolVersion =
        (request.headers["mcp-protocol-version"] as string) || "2025-03-26";

      if (!SUPPORTED_MCP_VERSIONS.includes(protocolVersion as any)) {
        logger.warn("Unsupported protocol version in header", {
          requested: protocolVersion,
          supported: [...SUPPORTED_MCP_VERSIONS],
        });
        reply.code(400).send({
          error: "Unsupported protocol version",
          supported: SUPPORTED_MCP_VERSIONS,
          received: protocolVersion,
        });
        return;
      }

      // Log version usage for monitoring
      if (!request.headers["mcp-protocol-version"]) {
        logger.info(
          "No MCP-Protocol-Version header, using default for backwards compatibility",
          {
            defaultVersion: "2025-03-26",
            supportedVersions: [...SUPPORTED_MCP_VERSIONS],
          }
        );
      } else if (protocolVersion !== MCP_PROTOCOL_VERSION) {
        logger.info("Using backward compatible protocol version in header", {
          requestedVersion: protocolVersion,
          currentVersion: MCP_PROTOCOL_VERSION,
        });
      }

      // Handle GET requests for SSE streams
      if (request.method === "GET") {
        return this.handleSSEStream(request, reply);
      }

      // Handle POST requests with JSON-RPC
      if (request.method === "POST") {
        return this.handleJSONRPC(request, reply, startTime);
      }

      // Handle DELETE requests (not supported)
      if (request.method === "DELETE") {
        reply.code(405).send({ error: "DELETE method not supported" });
        return;
      }

      reply.code(405).send({ error: "Method not allowed" });
    } catch (error) {
      logger.error("MCP Handler Error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      reply.code(500).send({ error: "Internal server error" });
    }
  }

  /**
   * Handle SSE stream requests (GET method)
   */
  private async handleSSEStream(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Validate Accept header for SSE
    const acceptHeader = request.headers.accept;
    if (!acceptHeader?.includes("text/event-stream")) {
      reply.code(405).send({ error: "Method Not Allowed" });
      return;
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 30000);

    // Handle client disconnect
    request.raw.on("close", () => {
      clearInterval(heartbeat);
    });

    logger.info("SSE stream opened");
  }

  /**
   * Handle JSON-RPC requests (POST method)
   */
  private async handleJSONRPC(
    request: FastifyRequest,
    reply: FastifyReply,
    startTime: number
  ): Promise<void> {
    // Validate Content-Type
    const contentType = request.headers["content-type"];
    if (!contentType?.includes("application/json")) {
      reply.code(400).send({
        error: "Invalid Content-Type",
        message: "Content-Type must be application/json",
      });
      return;
    }

    // Validate Accept header
    const acceptHeader = request.headers.accept;
    if (
      !acceptHeader?.includes("application/json") &&
      !acceptHeader?.includes("text/event-stream")
    ) {
      reply.code(400).send({
        error: "Invalid Accept header",
        message: "Accept must include application/json or text/event-stream",
      });
      return;
    }

    // Parse JSON-RPC message
    const body = request.body as MCPRequest | MCPNotification;
    if (!body || body.jsonrpc !== "2.0") {
      reply.code(400).send({ error: "Invalid JSON-RPC request" });
      return;
    }

    // Optional authentication
    const authContext = await this.authMiddleware.optionalAuth(request, reply);

    // Handle notifications (no response expected)
    if (!("id" in body)) {
      const notification = body as MCPNotification;
      await this.handleNotification(notification);
      reply.code(202).send();
      return;
    }

    // Handle requests
    const mcpRequest = body as MCPRequest;

    if (mcpRequest.method === "tools/call") {
      return this.mcpServer.handleToolsCall(
        request,
        mcpRequest,
        reply,
        startTime,
        authContext
      );
    }

    return this.handleJSONResponse(
      request,
      mcpRequest,
      reply,
      startTime,
      authContext
    );
  }

  /**
   * Handle JSON responses for standard requests
   */
  private async handleJSONResponse(
    httpRequest: FastifyRequest,
    mcpRequest: MCPRequest,
    reply: FastifyReply,
    startTime: number,
    authContext: AuthContext
  ): Promise<void> {
    switch (mcpRequest.method) {
      case "initialize":
        return this.mcpServer.handleInitialize(
          mcpRequest,
          reply,
          startTime,
          authContext
        );
      case "tools/list":
        return this.mcpServer.handleToolsList(
          mcpRequest,
          reply,
          startTime,
          authContext
        );
      case "tools/call":
        return this.mcpServer.handleToolsCall(
          httpRequest,
          mcpRequest,
          reply,
          startTime,
          authContext
        );
      case "ping":
        return this.handlePing(mcpRequest, reply, startTime);
      default:
        reply.code(400).send({
          jsonrpc: "2.0",
          error: {
            code: MCP_ERROR_CODES.METHOD_NOT_FOUND,
            message: `Unknown method: ${mcpRequest.method}`,
          },
        });
    }
  }

  /**
   * Handle ping request for connection health check
   * According to MCP specification, must return empty result object
   */
  private async handlePing(
    mcpRequest: MCPRequest,
    reply: FastifyReply,
    startTime: number
  ): Promise<void> {
    // MCP specification requires empty result object for ping response
    const response: MCPResponse = {
      jsonrpc: "2.0",
      id: mcpRequest.id,
      result: {}, // Empty object as per MCP specification
    };

    // Log detailed ping information for debugging (not in response)
    logger.info("Ping request handled", {
      requestId: mcpRequest.id,
      processingTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      server: APP_CONSTANTS.SERVER_NAME,
      version: APP_CONSTANTS.SERVER_VERSION,
      protocolVersion: MCP_PROTOCOL_VERSION,
      clientInfo: "MCP ping health check",
    });

    reply.code(200).send(response);
  }

  /**
   * Handle MCP notifications
   */
  private async handleNotification(
    notification: MCPNotification
  ): Promise<void> {
    switch (notification.method) {
      case "notifications/initialized":
        this.clientInitialized = true;
        logger.info("Client initialized notification received", {
          method: notification.method,
          clientReady: true,
          initialized: this.clientInitialized,
        });
        break;
      default:
        logger.warn("Unknown notification method", {
          method: notification.method,
        });
        break;
    }
  }
}
