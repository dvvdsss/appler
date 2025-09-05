/**
 * Fetch Tool Handler
 * Handles MCP fetch tool requests for content retrieval
 */

import type {
  AuthContext,
  MCPResponse,
  RateLimitResult,
  Services,
} from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import {
  convertYouTubeShortUrl,
  validateAndNormalizeUrl,
} from "../../utils/url-processor.js";
import {
  createErrorResponse,
  createSuccessResponse,
  formatFetchResponse,
} from "../formatters/response-formatter.js";
import { APP_CONSTANTS, MCP_ERROR_CODES } from "../protocol-handler.js";

export interface FetchToolArgs {
  url: string;
}

export class FetchTool {
  constructor(private services: Services) {}

  /**
   * Handle fetch tool request
   */
  async handle(
    id: string | number,
    args: FetchToolArgs,
    authContext: AuthContext,
    httpRequest: Request
  ): Promise<MCPResponse> {
    const startTime = Date.now();
    const { url } = args;

    // Validate URL parameter
    if (!url || typeof url !== "string" || url.trim().length === 0) {
      return createErrorResponse(
        id,
        MCP_ERROR_CODES.INVALID_PARAMS,
        "URL parameter is required and must be a valid string"
      );
    }

    const ipAddress = this.extractClientIP(httpRequest);

    // Rate limiting check
    const rateLimitResult = await this.services.rateLimit.checkLimits(
      ipAddress,
      authContext
    );

    if (!rateLimitResult.allowed) {
      // Log rate-limited fetch request to database
      await this.logFetch(
        authContext,
        url,
        url,
        "",
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

    try {
      // Pre-process URL: convert youtu.be to youtube.com format for database compatibility
      const preprocessedUrl = convertYouTubeShortUrl(url);

      // Validate and normalize URL
      const urlResult = validateAndNormalizeUrl(preprocessedUrl);
      if (!urlResult.isValid) {
        logger.warn(`Invalid URL provided: ${url} - ${urlResult.error}`);

        return createErrorResponse(
          id,
          MCP_ERROR_CODES.INVALID_PARAMS,
          `Invalid URL: ${urlResult.error}`
        );
      }

      // Use normalized URL for database lookup
      const processedUrl = urlResult.normalizedUrl;
      const page = await this.services.database.getPageByUrl(processedUrl);
      const responseTime = Date.now() - startTime;

      if (!page) {
        // Log failed fetch
        await this.logFetch(
          authContext,
          url,
          processedUrl,
          "",
          responseTime,
          ipAddress,
          404,
          "NOT_FOUND"
        );

        return createErrorResponse(
          id,
          MCP_ERROR_CODES.INVALID_PARAMS,
          `No content found for URL: ${url}`
        );
      }

      // Log successful fetch
      await this.logFetch(
        authContext,
        url,
        processedUrl,
        page.id,
        responseTime,
        ipAddress
      );

      // Format response with professional styling
      const formattedContent = formatFetchResponse(
        {
          success: true,
          title: page.title || undefined,
          content: page.content,
        },
        authContext.isAuthenticated
      );

      return createSuccessResponse(id, formattedContent);
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Log failed fetch
      await this.logFetch(
        authContext,
        url,
        url,
        "",
        responseTime,
        ipAddress,
        500,
        "FETCH_FAILED"
      );

      logger.error(
        `Fetch failed for URL ${url}: ${error instanceof Error ? error.message : String(error)} (authenticated: ${authContext.isAuthenticated})`
      );

      return createErrorResponse(
        id,
        MCP_ERROR_CODES.INTERNAL_ERROR,
        "Failed to fetch content from the specified URL"
      );
    }
  }

  /**
   * Log fetch operation
   */
  private async logFetch(
    authContext: AuthContext,
    requestedUrl: string,
    actualUrl: string,
    pageId: string,
    responseTime: number,
    ipAddress: string,
    statusCode: number = 200,
    errorCode?: string
  ): Promise<void> {
    if (!this.services.logger) return;

    try {
      await this.services.logger.logFetch({
        userId: authContext.userId || `anon_${ipAddress}`,
        requestedUrl,
        actualUrl,
        pageId,
        responseTimeMs: responseTime,
        ipAddress,
        statusCode,
        errorCode,
        mcpToken: authContext.token || null,
      });
    } catch (error) {
      logger.error(
        `Failed to log fetch: ${error instanceof Error ? error.message : String(error)}`
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
