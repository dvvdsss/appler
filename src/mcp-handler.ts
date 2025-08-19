/**
 * Modern MCP Streamable HTTP Handler - Main Controller
 * Fully compliant with MCP 2025-06-18 Streamable HTTP specification
 * Supports Server-Sent Events for streaming responses
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { type AuthContext, AuthMiddleware } from "./auth/auth-middleware.js";
import { logger } from "./logger.js";
import {
  MCP_ERROR_CODES,
  MCP_PROTOCOL_VERSION,
  type MCPNotification,
  MCPProtocol,
  type MCPRequest,
} from "./mcp-protocol.js";
import { MCPUtils } from "./mcp-utils.js";
import { D1Connector } from "./services/d1-connector.js";
import { QueryLogger } from "./services/query-logger.js";
import { RAGService } from "./services/rag-service.js";
import { RateLimitService } from "./services/rate-limit-service.js";
import type { AppConfig } from "./types/env.js";

export class MCPHandler {
  private ragService: RAGService;
  private authMiddleware: AuthMiddleware;
  private mcpProtocol: MCPProtocol;
  private mcpUtils: MCPUtils;
  private ragInitialized = false;

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
    const rateLimitService = new RateLimitService(d1Connector);
    const queryLogger = new QueryLogger(d1Config);

    // Initialize authentication middleware
    this.authMiddleware = new AuthMiddleware(d1Config);

    // Initialize protocol and utils handlers
    this.mcpProtocol = new MCPProtocol(
      this.ragService,
      rateLimitService,
      queryLogger,
      this.ragInitialized
    );

    this.mcpUtils = new MCPUtils(
      this.ragService,
      rateLimitService,
      queryLogger,
      this.ragInitialized
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
      this.ragInitialized = true;
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
      // Validate MCP-Protocol-Version header
      const protocolVersion = request.headers["mcp-protocol-version"] as string;
      if (protocolVersion && protocolVersion !== MCP_PROTOCOL_VERSION) {
        reply.code(400).send({
          error: "Unsupported protocol version",
          supported: MCP_PROTOCOL_VERSION,
          received: protocolVersion,
        });
        return;
      }

      // Handle GET requests for SSE streams
      if (request.method === "GET") {
        return this.handleSSEStream(request, reply);
      }

      // Handle POST requests with JSON-RPC
      if (request.method === "POST") {
        return this.handleJSONRPC(request, reply, startTime);
      }

      // Handle DELETE requests (optional session termination)
      if (request.method === "DELETE") {
        reply.code(405).send({ error: "Session termination not supported" });
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
      reply.code(202).send();
      return;
    }

    // Handle requests - decide between SSE or JSON response
    const mcpRequest = body as MCPRequest;
    const preferSSE = acceptHeader?.includes("text/event-stream");

    if (preferSSE && mcpRequest.method === "tools/call") {
      return this.mcpUtils.handleToolsCallSSE(
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
        return this.mcpProtocol.handleInitialize(
          mcpRequest,
          reply,
          startTime,
          authContext
        );
      case "tools/list":
        return this.mcpProtocol.handleToolsList(
          mcpRequest,
          reply,
          startTime,
          authContext
        );
      case "tools/call":
        return this.mcpProtocol.handleToolsCall(
          httpRequest,
          mcpRequest,
          reply,
          startTime,
          authContext
        );
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
}
