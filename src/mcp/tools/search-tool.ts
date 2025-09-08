/**
 * Search Tool Handler
 * Handles MCP search tool requests with RAG processing
 */

import type {
  AuthContext,
  MCPResponse,
  RateLimitResult,
  Services,
} from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { cleanQuerySafely } from "../../utils/query-cleaner.js";
import {
  createErrorResponse,
  createSuccessResponse,
  formatRAGResponse,
} from "../formatters/response-formatter.js";
import { APP_CONSTANTS, MCP_ERROR_CODES } from "../protocol-handler.js";

export interface SearchToolArgs {
  query: string;
  result_count?: number;
}

export class SearchTool {
  constructor(private services: Services) {}

  /**
   * Handle search tool request
   */
  async handle(
    id: string | number,
    args: SearchToolArgs,
    authContext: AuthContext,
    httpRequest: Request
  ): Promise<MCPResponse> {
    const startTime = Date.now();
    let { query, result_count = 4 } = args;

    // Validate query parameter
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return createErrorResponse(
        id,
        MCP_ERROR_CODES.INVALID_PARAMS,
        APP_CONSTANTS.MISSING_SEARCH_ERROR
      );
    }

    // Clean the query to remove temporal information
    const originalQuery = query;
    query = cleanQuerySafely(query);

    // Log query cleaning if significant changes were made
    if (query !== originalQuery) {
      logger.info(`Query cleaned for search: "${originalQuery}" -> "${query}"`);
    }

    // Validate and clamp result_count parameter
    let adjustedResultCount = result_count;
    let wasAdjusted = false;

    if (typeof result_count !== "number") {
      adjustedResultCount = 4; // Default value
      wasAdjusted = true;
    } else if (result_count < 1) {
      adjustedResultCount = 1;
      wasAdjusted = true;
    } else if (result_count > 10) {
      adjustedResultCount = 10;
      wasAdjusted = true;
    }

    // Update result_count for processing
    result_count = adjustedResultCount;

    // Check if request wants SSE
    const isSSE = httpRequest.headers
      .get("accept")
      ?.includes("text/event-stream");

    if (isSSE) {
      // Handle SSE request
      return await this.handleSSE(
        id,
        query,
        result_count,
        authContext,
        httpRequest,
        wasAdjusted
      );
    }

    try {
      // Rate limiting check
      const clientIP = this.extractClientIP(httpRequest);
      const rateLimitResult = await this.services.rateLimit.checkLimits(
        clientIP,
        authContext
      );

      if (!rateLimitResult.allowed) {
        // Log rate limit hit
        logger.info(
          `Rate limit exceeded for user ${authContext.userId || `anon_${clientIP}`} (authenticated: ${authContext.isAuthenticated}, limit_type: ${rateLimitResult.limitType}, limit: ${rateLimitResult.limit}, remaining: ${rateLimitResult.remaining}, plan_type: ${rateLimitResult.planType})`
        );

        // Log rate-limited request to database
        await this.logSearch(
          authContext,
          query,
          { count: 0 },
          0,
          clientIP,
          429,
          "RATE_LIMIT_EXCEEDED"
        );

        const rateLimitMessage = this.buildRateLimitMessage(
          rateLimitResult,
          authContext
        );
        return createErrorResponse(
          id,
          MCP_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          rateLimitMessage
        );
      }

      const ragResult = await this.processQuery(
        query,
        result_count,
        authContext,
        this.extractClientIP(httpRequest),
        startTime
      );

      const formattedResponse = formatRAGResponse(
        ragResult,
        authContext.isAuthenticated,
        wasAdjusted
      );

      return createSuccessResponse(id, formattedResponse);
    } catch (error) {
      logger.error(
        `RAG query failed for query "${query}" (result_count: ${result_count}): ${error instanceof Error ? error.message : String(error)}`
      );

      return createErrorResponse(
        id,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        APP_CONSTANTS.SEARCH_FAILED_ERROR
      );
    }
  }

  /**
   * Handle search with Server-Sent Events (SSE)
   */
  private async handleSSE(
    id: string | number,
    query: string,
    resultCount: number,
    authContext: AuthContext,
    httpRequest: Request,
    wasAdjusted: boolean
  ): Promise<MCPResponse> {
    const startTime = Date.now();
    const ipAddress = this.extractClientIP(httpRequest);

    // Clean the query to remove temporal information for SSE as well
    const originalQuery = query;
    query = cleanQuerySafely(query);

    // Log query cleaning if significant changes were made
    if (query !== originalQuery) {
      logger.info(
        `Query cleaned for SSE search: "${originalQuery}" -> "${query}"`
      );
    }

    try {
      // Rate limiting check for SSE
      const rateLimitResult = await this.services.rateLimit.checkLimits(
        ipAddress,
        authContext
      );

      if (!rateLimitResult.allowed) {
        // Log rate-limited SSE request to database
        await this.logSearch(
          authContext,
          query,
          { count: 0 },
          0,
          ipAddress,
          429,
          "RATE_LIMIT_EXCEEDED"
        );

        const rateLimitMessage = this.buildRateLimitMessage(
          rateLimitResult,
          authContext
        );
        return createErrorResponse(
          id,
          MCP_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          rateLimitMessage
        );
      }

      // Send progress notification (simulated for Worker environment)
      logger.info(
        `SSE search progress for query "${query}" (progress: 0.1, stage: starting_rag_query, authenticated: ${authContext.isAuthenticated})`
      );

      // Execute RAG query with progress tracking
      const ragResult = await this.services.rag.query({
        query,
        result_count: resultCount,
      });

      const responseTime = Date.now() - startTime;

      // Log search
      await this.logSearch(
        authContext,
        query,
        ragResult,
        responseTime,
        ipAddress
      );

      // Format and return response
      const formattedResponse = formatRAGResponse(
        ragResult,
        authContext.isAuthenticated,
        wasAdjusted
      );

      return createSuccessResponse(id, formattedResponse);
    } catch (error) {
      logger.error(
        `SSE search failed for query "${query}" (length: ${query.length}, result_count: ${resultCount}, authenticated: ${authContext.isAuthenticated}): ${error instanceof Error ? error.message : String(error)}`
      );

      return createErrorResponse(
        id,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        APP_CONSTANTS.SEARCH_FAILED_ERROR
      );
    }
  }

  /**
   * Process RAG query - unified business logic
   */
  private async processQuery(
    query: string,
    resultCount: number,
    authContext: AuthContext,
    ipAddress: string,
    startTime: number
  ) {
    // Execute RAG query
    const ragResult = await this.services.rag.query({
      query,
      result_count: resultCount,
    });

    const totalResponseTime = Date.now() - startTime;

    // Log search to database
    await this.logSearch(
      authContext,
      query,
      ragResult,
      totalResponseTime,
      ipAddress
    );

    return ragResult;
  }

  /**
   * Log search operation
   */
  private async logSearch(
    authContext: AuthContext,
    searchQuery: string,
    ragResult: { count?: number },
    responseTime: number,
    ipAddress: string,
    statusCode: number = 200,
    errorCode?: string
  ): Promise<void> {
    if (!this.services.logger) return;

    try {
      await this.services.logger.logSearch({
        userId: authContext.userId || `anon_${ipAddress}`,
        searchQuery,
        resultCount: ragResult?.count || 0,
        responseTimeMs: responseTime,
        ipAddress,
        statusCode,
        errorCode,
        mcpToken: authContext.token || null,
      });
    } catch (error) {
      logger.error(
        `Failed to log search to database for query "${searchQuery}" (user_id: ${authContext.userId || `anon_${ipAddress}`}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Build rate limit message
   */
  private buildRateLimitMessage(
    rateLimitResult: RateLimitResult,
    authContext: AuthContext
  ): string {
    if (rateLimitResult.limitType === "minute") {
      const resetTime = new Date(rateLimitResult.minuteResetAt!);
      const waitSeconds = Math.ceil((resetTime.getTime() - Date.now()) / 1000);

      return authContext.isAuthenticated
        ? `Rate limit reached for ${rateLimitResult.planType} plan (${rateLimitResult.minuteLimit} queries per minute). Please wait ${waitSeconds} seconds before trying again.`
        : `Rate limit reached for anonymous access (${rateLimitResult.minuteLimit} query per minute). Please wait ${waitSeconds} seconds before trying again. Subscribe at ${APP_CONSTANTS.SUBSCRIPTION_URL} for higher limits.`;
    } else {
      return authContext.isAuthenticated
        ? `Weekly limit reached for ${rateLimitResult.planType} plan (${rateLimitResult.limit} queries per week). Upgrade to Pro at ${APP_CONSTANTS.SUBSCRIPTION_URL} for higher limits.`
        : `Weekly limit reached for anonymous access (${rateLimitResult.limit} queries per week). Subscribe at ${APP_CONSTANTS.SUBSCRIPTION_URL} for higher limits.`;
    }
  }

  /**
   * Extract client IP address from Worker request
   */
  private extractClientIP(request: Request): string {
    return (
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown"
    );
  }
}
