/**
 * Modern MCP Protocol Handler - Stateless Design
 * Compliant with MCP 2025-06-18 specification
 * Integrated rate limiting and simplified architecture
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { AppConfig } from "./types/env.js";
import { RAGService } from "./services/rag-service.js";
import { RateLimitService } from "./services/rate-limit-service.js";
import { AuthMiddleware, AuthContext } from "./auth/auth-middleware.js";
import { QueryLogger } from "./services/query-logger.js";
import { D1Connector } from "./services/d1-connector.js";
import { logger } from "./logger.js";
// MCP Protocol Types and Constants
interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPNotification {
  jsonrpc: "2.0";
  method: string;
  params?: any;
}

interface InitializeParams {
  protocolVersion: string;
  capabilities: any;
  clientInfo: {
    name: string;
    version: string;
  };
}

interface ToolsCallParams {
  name: string;
  arguments?: any;
}

// Application Constants
const MCP_PROTOCOL_VERSION = "2025-06-18";
const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  RATE_LIMIT_EXCEEDED: -32003,
} as const;

const APP_CONSTANTS = {
  SERVER_NAME: "apple-rag-mcp",
  SERVER_VERSION: "2.0.0",
  PRICING_URL: "https://apple-rag.com/#pricing",
  UPGRADE_MESSAGE: "Upgrade to Pro for higher limits",
  ANONYMOUS_MESSAGE:
    "⚠️ *Anonymous access - consider getting a token for unlimited queries*",
  TOOL_NAME: "query",
  TOOL_DESCRIPTION:
    "Query Apple's technical documentation using RAG (Retrieval-Augmented Generation)",
  UNKNOWN_TOOL_ERROR: "Unknown tool",
  MISSING_QUERY_ERROR: "Missing or invalid 'query' parameter",
  QUERY_FAILED_ERROR: "Failed to process query",
  RATE_LIMIT_ERROR: "Rate limit exceeded",
  NO_RESULTS_MESSAGE:
    "I couldn't find relevant information for your query. Please try rephrasing your question or asking about specific Apple technologies.",
} as const;

export class MCPHandler {
  private ragService: RAGService;
  private rateLimitService: RateLimitService;
  private authMiddleware: AuthMiddleware;
  private queryLogger: QueryLogger;
  private ragInitialized = false;
  private supportedProtocolVersion = MCP_PROTOCOL_VERSION;

  constructor(config: AppConfig) {
    this.ragService = new RAGService(config);

    // Pre-initialize RAG service for optimal performance
    this.preInitializeRAGService();

    // Create Cloudflare D1 configuration
    const d1Config = {
      accountId: config.CLOUDFLARE_ACCOUNT_ID,
      apiToken: config.CLOUDFLARE_API_TOKEN,
      databaseId: config.CLOUDFLARE_D1_DATABASE_ID,
    };

    this.authMiddleware = new AuthMiddleware(d1Config);
    this.queryLogger = new QueryLogger(d1Config);

    // Initialize rate limiting service
    const d1Connector = new D1Connector(d1Config);
    this.rateLimitService = new RateLimitService(d1Connector);

    logger.info("MCP Handler initialized", {
      protocolVersion: this.supportedProtocolVersion,
      rateLimitingEnabled: true,
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
   * Handle MCP requests - Stateless with rate limiting
   */
  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate Content-Type for POST requests
      if (request.method === "POST") {
        const contentType = request.headers["content-type"];
        if (!contentType || !contentType.includes("application/json")) {
          reply.code(400).send({
            error: "Invalid Content-Type",
            message: "Content-Type must be application/json",
          });
          return;
        }
      }

      // Parse request body
      const body = request.body as MCPRequest | MCPNotification;
      if (!body || body.jsonrpc !== "2.0") {
        return this.sendError(
          reply,
          "Invalid JSON-RPC request",
          -32600,
          startTime
        );
      }

      // Optional authentication
      const authContext = await this.authMiddleware.optionalAuth(
        request,
        reply
      );

      // Handle notifications (no response expected)
      if (!("id" in body)) {
        return this.handleNotification(
          body as MCPNotification,
          reply,
          startTime,
          authContext
        );
      }

      // Handle requests (response required)
      const mcpRequest = body as MCPRequest;

      switch (mcpRequest.method) {
        case "initialize":
          return this.handleInitialize(
            mcpRequest,
            reply,
            startTime,
            authContext
          );

        case "tools/list":
          return this.handleToolsList(
            mcpRequest,
            reply,
            startTime,
            authContext
          );

        case "tools/call":
          return this.handleToolsCall(
            request,
            mcpRequest,
            reply,
            startTime,
            authContext
          );

        default:
          return this.sendError(
            reply,
            `Unknown method: ${mcpRequest.method}`,
            -32601,
            startTime
          );
      }
    } catch (error) {
      logger.error("MCP Handler Error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return this.sendError(reply, "Internal server error", -32603, startTime);
    }
  }

  /**
   * Handle MCP notifications (no response expected)
   */
  private async handleNotification(
    notification: MCPNotification,
    reply: FastifyReply,
    startTime: number,
    authContext: AuthContext
  ): Promise<void> {
    logger.debug("Handling notification", {
      method: notification.method,
      userId: authContext?.userData?.userId,
      processingTime: Date.now() - startTime,
    });

    // For simplified MCP server, we just acknowledge notifications
    reply.code(202).send();
  }

  /**
   * Handle initialize request - Stateless initialization
   */
  private async handleInitialize(
    request: MCPRequest,
    reply: FastifyReply,
    startTime: number,
    authContext: AuthContext
  ): Promise<void> {
    const params = request.params as InitializeParams;

    // Validate protocol version
    if (params.protocolVersion !== this.supportedProtocolVersion) {
      return this.sendError(
        reply,
        "Unsupported protocol version",
        -32602,
        startTime,
        {
          supported: [this.supportedProtocolVersion],
          requested: params.protocolVersion,
        }
      );
    }

    const response: MCPResponse = {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: this.supportedProtocolVersion,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: APP_CONSTANTS.SERVER_NAME,
          version: APP_CONSTANTS.SERVER_VERSION,
        },
      },
    };

    logger.info("MCP Initialize", {
      clientInfo: params.clientInfo,
      protocolVersion: params.protocolVersion,
      authenticated: authContext.isAuthenticated,
      userId: authContext.userData?.userId,
      processingTime: Date.now() - startTime,
    });

    // No session ID header for stateless design
    reply.code(200).send(response);
  }

  /**
   * Handle tools/list request
   */
  private async handleToolsList(
    request: MCPRequest,
    reply: FastifyReply,
    startTime: number,
    authContext: AuthContext
  ): Promise<void> {
    const tools = [
      {
        name: APP_CONSTANTS.TOOL_NAME,
        description: APP_CONSTANTS.TOOL_DESCRIPTION,
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                "Your question about Apple technologies, frameworks, or development",
            },
          },
          required: ["query"],
        },
      },
    ];

    const response: MCPResponse = {
      jsonrpc: "2.0",
      id: request.id,
      result: { tools },
    };

    logger.debug("Tools list requested", {
      authenticated: authContext.isAuthenticated,
      userId: authContext.userData?.userId,
      processingTime: Date.now() - startTime,
    });

    reply.code(200).send(response);
  }

  /**
   * Handle tools/call request
   */
  private async handleToolsCall(
    httpRequest: FastifyRequest,
    mcpRequest: MCPRequest,
    reply: FastifyReply,
    startTime: number,
    authContext: AuthContext
  ): Promise<void> {
    const params = mcpRequest.params as ToolsCallParams;

    // Validate tool name
    if (params.name !== APP_CONSTANTS.TOOL_NAME) {
      return this.sendError(
        reply,
        `${APP_CONSTANTS.UNKNOWN_TOOL_ERROR}: ${params.name}`,
        MCP_ERROR_CODES.METHOD_NOT_FOUND,
        startTime
      );
    }

    // Validate query parameter
    const args = params.arguments;
    if (!args?.query || typeof args.query !== "string") {
      return this.sendError(
        reply,
        APP_CONSTANTS.MISSING_QUERY_ERROR,
        MCP_ERROR_CODES.INVALID_PARAMS,
        startTime
      );
    }

    // Check rate limits for tools/call only
    const rateLimitResult = await this.rateLimitService.checkLimits(
      httpRequest.ip,
      authContext
    );

    // Handle rate limiting with friendly message
    if (!rateLimitResult.allowed) {
      let rateLimitMessage: string;

      if (rateLimitResult.limitType === "minute") {
        // Minute limit hit - show retry time
        const resetTime = new Date(rateLimitResult.minuteResetAt!);
        const waitSeconds = Math.ceil(
          (resetTime.getTime() - Date.now()) / 1000
        );

        rateLimitMessage = authContext.isAuthenticated
          ? `Rate limit reached (${rateLimitResult.planType} plan: ${rateLimitResult.minuteLimit}/minute). Please wait ${waitSeconds} seconds before trying again.`
          : `Rate limit reached (${rateLimitResult.minuteLimit}/minute for anonymous users). Please wait ${waitSeconds} seconds before trying again.`;
      } else {
        // Weekly limit hit - show upgrade message
        rateLimitMessage = authContext.isAuthenticated
          ? `Rate limit reached (${rateLimitResult.planType} plan: ${rateLimitResult.limit}/week). Upgrade to Pro for higher limits: ${APP_CONSTANTS.PRICING_URL}`
          : `Rate limit reached (${rateLimitResult.limit}/week for anonymous users). Get a free account for higher limits: ${APP_CONSTANTS.PRICING_URL}`;
      }

      const response: MCPResponse = {
        jsonrpc: "2.0",
        id: mcpRequest.id,
        result: {
          content: [
            {
              type: "text",
              text: rateLimitMessage,
            },
          ],
        },
      };

      reply.code(200).send(response);
      return;
    }

    try {
      const resultCount = args.result_count || 5; // Use user-specified count or default to 5
      const ragResult = await this.executeRAGQuery(args.query, resultCount);
      const responseTime = Date.now() - startTime;

      await this.logQuery(
        authContext,
        args.query,
        ragResult,
        responseTime,
        httpRequest.ip
      );

      const response = this.createSuccessResponse(
        mcpRequest.id,
        ragResult,
        authContext.isAuthenticated
      );

      this.logQueryCompletion(args.query, ragResult, authContext, responseTime);

      reply.code(200).send(response);
    } catch (error) {
      this.logQueryError(error, args.query, authContext);
      return this.sendError(
        reply,
        APP_CONSTANTS.QUERY_FAILED_ERROR,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        startTime
      );
    }
  }

  /**
   * Execute RAG query with initialization check
   */
  private async executeRAGQuery(
    query: string,
    resultCount: number = 5
  ): Promise<any> {
    if (!this.ragInitialized) {
      await this.ragService.initialize();
      this.ragInitialized = true;
    }
    return this.ragService.query({ query, result_count: resultCount });
  }

  /**
   * Create success response for RAG query
   */
  private createSuccessResponse(
    requestId: string | number,
    ragResult: any,
    isAuthenticated: boolean
  ): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: requestId,
      result: {
        content: [
          {
            type: "text",
            text: this.formatRAGResponse(ragResult, isAuthenticated),
          },
        ],
      },
    };
  }

  /**
   * Log successful query completion
   */
  private logQueryCompletion(
    query: string,
    ragResult: any,
    authContext: AuthContext,
    responseTime: number
  ): void {
    logger.info("RAG query completed", {
      query,
      resultCount: ragResult?.count || 0,
      authenticated: authContext.isAuthenticated,
      userId: authContext.userData?.userId,
      processingTime: responseTime,
    });
  }

  /**
   * Log query error
   */
  private logQueryError(
    error: unknown,
    query: string,
    authContext: AuthContext
  ): void {
    logger.error("RAG query failed", {
      error: error instanceof Error ? error.message : String(error),
      query,
      authenticated: authContext.isAuthenticated,
      userId: authContext.userData?.userId,
    });
  }

  /**
   * Log query for analytics and usage tracking
   */
  private async logQuery(
    authContext: AuthContext,
    query: string,
    ragResult: any,
    responseTime: number,
    ipAddress: string
  ): Promise<void> {
    try {
      const logEntry = {
        userId:
          authContext.isAuthenticated && authContext.userData
            ? authContext.userData.userId
            : "anonymous",
        queryText: query.trim(),
        resultCount: ragResult?.count || 0,
        responseTimeMs: responseTime,
        statusCode: 200,
        ipAddress,
      };

      await this.queryLogger.logQuery(logEntry);
    } catch (error) {
      logger.error("Failed to log query", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Format RAG response with authentication-aware messaging
   */
  private formatRAGResponse(ragResult: any, isAuthenticated: boolean): string {
    if (
      !ragResult ||
      !ragResult.success ||
      !ragResult.results ||
      ragResult.results.length === 0
    ) {
      return APP_CONSTANTS.NO_RESULTS_MESSAGE;
    }

    // Return only the content from chunks, no URLs or metadata
    const results = ragResult.results; // Use all results as requested by user
    let response = "";

    results.forEach((result: any, index: number) => {
      if (index > 0) response += "\n\n---\n\n"; // Separator between results
      response += result.content; // Only content, no URLs or titles
    });

    const anonymousMessage = isAuthenticated
      ? ""
      : `\n\n${APP_CONSTANTS.ANONYMOUS_MESSAGE}`;

    return `${response}${anonymousMessage}`;
  }

  /**
   * Send error response with proper JSON-RPC format
   */
  private sendError(
    reply: FastifyReply,
    message: string,
    code: number,
    startTime: number,
    data?: any,
    httpStatus: number = 400
  ): void {
    const response: MCPResponse = {
      jsonrpc: "2.0",
      error: {
        code,
        message,
        data,
      },
    };

    logger.error("MCP Error Response", {
      code,
      message,
      httpStatus,
      processingTime: Date.now() - startTime,
      data,
    });

    reply.code(httpStatus).send(response);
  }
}
