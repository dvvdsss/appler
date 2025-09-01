/**
 * Simple MCP Authentication Middleware
 */

import { IPAuthenticationService } from "../services/ip-authentication.js";
import type { AuthContext } from "../types/index.js";
import { logger } from "../utils/logger.js";
import { TokenValidator, type UserTokenData } from "./token-validator.js";

export class AuthMiddleware {
  private readonly tokenValidator: TokenValidator;
  private readonly ipAuthService: IPAuthenticationService;

  constructor(d1: D1Database) {
    this.tokenValidator = new TokenValidator(d1);
    this.ipAuthService = new IPAuthenticationService(d1);
  }

  /**
   * Extract Bearer token from Authorization header
   */
  private extractBearerToken(authHeader?: string): string | null {
    if (!authHeader) return null;
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  }

  /**
   * Optional authentication middleware
   * Validates token if present, or checks IP-based authentication, allows access without either
   */
  async optionalAuth(request: Request): Promise<AuthContext> {
    const authHeader = request.headers.get("authorization");
    const token = this.extractBearerToken(authHeader || undefined);
    const clientIP = this.getClientIP(request);

    // Try token authentication first
    if (token) {
      const validation = await this.tokenValidator.validateToken(token);

      if (validation.valid) {
        logger.debug("Token authentication successful", {
          userId: validation.userData?.userId,
        });

        return {
          isAuthenticated: true,
          userId: validation.userData?.userId,
          email: validation.userData?.email,
          token: token,
        };
      }

      logger.debug("Token validation failed", {
        error: validation.error,
        tokenPrefix: `${token.substring(0, 8)}...`,
        ip: clientIP,
      });
    }

    // Try IP-based authentication
    const ipAuthResult =
      await this.ipAuthService.checkIPAuthentication(clientIP);
    if (ipAuthResult) {
      logger.debug("IP-based authentication successful", {
        userId: ipAuthResult.userId,
        clientIP,
      });

      return {
        isAuthenticated: true,
        userId: ipAuthResult.userId,
        email: ipAuthResult.email,
        token: "ip-based",
      };
    }

    // No authentication method succeeded
    logger.debug(
      "No authentication provided - allowing unauthenticated access",
      {
        hasToken: !!token,
        clientIP,
      }
    );

    return { isAuthenticated: false };
  }

  /**
   * Get user data by user ID
   */
  async getUserData(userId: string): Promise<UserTokenData> {
    return await this.tokenValidator.getUserData(userId);
  }

  /**
   * Get client IP address from request (Worker optimized)
   */
  private getClientIP(request: Request): string {
    // Cloudflare provides client IP in CF-Connecting-IP header
    return (
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For") ||
      request.headers.get("X-Real-IP") ||
      "unknown"
    );
  }
}
