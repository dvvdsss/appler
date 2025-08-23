/**
 * Simple MCP Authentication Middleware
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../logger.js";
import type { CloudflareD1Config } from "../services/d1-connector.js";
import { IPAuthenticationService } from "../services/ip-authentication-service.js";
import { TokenValidator, type UserTokenData } from "./token-validator.js";

export interface AuthContext {
  readonly isAuthenticated: boolean;
  readonly userData?: UserTokenData;
  readonly token?: string;
}

export class AuthMiddleware {
  private readonly tokenValidator: TokenValidator;
  private readonly ipAuthService: IPAuthenticationService;

  constructor(d1Config: CloudflareD1Config) {
    this.tokenValidator = new TokenValidator(d1Config);
    this.ipAuthService = new IPAuthenticationService(d1Config);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.tokenValidator.destroy();
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
  async optionalAuth(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<AuthContext> {
    const authHeader = request.headers.authorization as string;
    const token = this.extractBearerToken(authHeader);
    const clientIP = request.ip;

    // Try token authentication first
    if (token) {
      const validation = await this.tokenValidator.validateToken(token);

      if (validation.valid) {
        logger.debug("Token authentication successful", {
          userId: validation.userData?.userId,
        });

        return {
          isAuthenticated: true,
          userData: validation.userData,
          token,
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
        userData: ipAuthResult,
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
}
