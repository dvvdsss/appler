/**
 * MCP Utilities - SSE, Response Formatting & Helper Functions
 * Provides utility functions for MCP Streamable HTTP transport
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { AuthContext } from "./auth/auth-middleware.js";
import { RateLimitService } from "./services/rate-limit-service.js";
import { RAGService } from "./services/rag-service.js";
import { QueryLogger } from "./services/query-logger.js";
import { logger } from "./logger.js";
import {
  MCPRequest,
  MCPResponse,
  ToolsCallParams,
  MCP_ERROR_CODES,
  APP_CONSTANTS,
} from "./mcp-protocol.js";

/**
 * MCP SSE and Utility Functions
 */
export class MCPUtils {
  constructor(
    private ragService: RAGService,
    private rateLimitService: RateLimitService,
    private queryLogger: QueryLogger,
    private ragInitialized: boolean = false
  ) {}

  /**
   * Handle tools/call with SSE streaming
   */
  async handleToolsCallSSE(
    httpRequest: FastifyRequest,
    mcpRequest: MCPRequest,
    reply: FastifyReply,
    startTime: number,
    authContext: AuthContext
  ): Promise<void> {
    const params = mcpRequest.params as ToolsCallParams;

    // Validate tool name
    if (params.name !== APP_CONSTANTS.TOOL_NAME) {
      return this.sendSSEError(
        reply,
        `${APP_CONSTANTS.UNKNOWN_TOOL_ERROR}: ${params.name}`,
        MCP_ERROR_CODES.METHOD_NOT_FOUND,
        mcpRequest.id
      );
    }

    // Validate query parameter
    const args = params.arguments;
    if (!args?.query || typeof args.query !== "string") {
      return this.sendSSEError(
        reply,
        APP_CONSTANTS.MISSING_QUERY_ERROR,
        MCP_ERROR_CODES.INVALID_PARAMS,
        mcpRequest.id
      );
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    try {
      // Rate limiting check
      const rateLimitResult = await this.rateLimitService.checkLimits(
        authContext.isAuthenticated
          ? authContext.userData!.userId
          : httpRequest.ip,
        authContext
      );

      if (!rateLimitResult.allowed) {
        const rateLimitMessage =
          rateLimitResult.limitType === "minute"
            ? `Rate limit reached (${rateLimitResult.minuteLimit} per minute). Please wait before trying again.`
            : `Weekly limit reached (${rateLimitResult.limit} queries per week). Subscribe at ${APP_CONSTANTS.SUBSCRIPTION_URL} for unlimited queries.`;

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
        this.sendSSEMessage(reply, response);
        reply.raw.end();
        return;
      }

      // Send progress update
      this.sendSSEMessage(reply, {
        jsonrpc: "2.0",
        method: "notifications/progress",
        params: { progress: 0.1, message: "Starting RAG query..." },
      });

      // Execute RAG query
      const resultCount = args.result_count || 5;
      const ragResult = await this.executeRAGQuery(args.query, resultCount);
      const responseTime = Date.now() - startTime;

      // Send progress update
      this.sendSSEMessage(reply, {
        jsonrpc: "2.0",
        method: "notifications/progress",
        params: { progress: 0.8, message: "Processing results..." },
      });

      // Log query
      await this.logQuery(
        authContext,
        args.query,
        ragResult,
        responseTime,
        httpRequest.ip
      );

      // Send final response
      const response = this.createSuccessResponse(
        mcpRequest.id,
        ragResult,
        authContext.isAuthenticated
      );

      this.sendSSEMessage(reply, response);
      reply.raw.end();

      logger.info("RAG query completed via SSE", {
        query: args.query,
        resultCount: ragResult?.count || 0,
        authenticated: authContext.isAuthenticated,
        processingTime: responseTime,
      });
    } catch (error) {
      this.sendSSEError(
        reply,
        APP_CONSTANTS.QUERY_FAILED_ERROR,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        mcpRequest.id
      );
      reply.raw.end();
    }
  }

  /**
   * Send SSE message
   */
  sendSSEMessage(reply: FastifyReply, message: any): void {
    const data = JSON.stringify(message);
    reply.raw.write(`data: ${data}\n\n`);
  }

  /**
   * Send SSE error
   */
  sendSSEError(
    reply: FastifyReply,
    message: string,
    code: number,
    id?: string | number
  ): void {
    const response: MCPResponse = {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
      },
    };
    this.sendSSEMessage(reply, response);
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

    const results = ragResult.results;
    let response = "";

    results.forEach((result: any, index: number) => {
      if (index > 0) response += "\n\n---\n\n";
      response += result.content;
    });

    const anonymousMessage = isAuthenticated
      ? ""
      : `\n\n${APP_CONSTANTS.ANONYMOUS_ACCESS_MESSAGE}`;

    return `${response}${anonymousMessage}`;
  }

  /**
   * Log query
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
}
