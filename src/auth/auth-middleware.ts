/**
 * Simple MCP Authentication Middleware
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { TokenValidator, UserTokenData } from "./token-validator.js";
import { CloudflareD1Config } from "../services/d1-connector.js";
import { logger } from "../logger.js";

export interface AuthContext {
  readonly isAuthenticated: boolean;
  readonly userData?: UserTokenData;
}

export class AuthMiddleware {
  private readonly tokenValidator: TokenValidator;

  constructor(d1Config: CloudflareD1Config) {
    this.tokenValidator = new TokenValidator(d1Config);
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
   * Validates token if present, allows access without token
   */
  async optionalAuth(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<AuthContext> {
    const authHeader = request.headers.authorization as string;
    const token = this.extractBearerToken(authHeader);

    // No token provided - allow access with no authentication
    if (!token) {
      logger.debug(
        "No authentication token provided - allowing unauthenticated access"
      );
      return { isAuthenticated: false };
    }

    // Token provided - validate it
    const validation = await this.tokenValidator.validateToken(token);

    if (!validation.valid) {
      logger.debug("Token validation failed", {
        error: validation.error,
        tokenPrefix: token.substring(0, 8) + "...",
        ip: request.ip,
      });

      // For optional auth, return unauthenticated context instead of throwing
      return { isAuthenticated: false };
    }

    logger.debug("Authentication successful", {
      userId: validation.userData?.userId,
    });

    return {
      isAuthenticated: true,
      userData: validation.userData,
    };
  }

  /**
   * Get user data by user ID
   */
  async getUserData(userId: string): Promise<UserTokenData> {
    return await this.tokenValidator.getUserData(userId);
  }
}
