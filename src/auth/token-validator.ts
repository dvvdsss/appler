/**
 * Simple MCP Token Validator
 * Validates MCP tokens against Cloudflare D1 database
 */

import { logger } from "../logger.js";
import {
  type CloudflareD1Config,
  D1Connector,
} from "../services/d1-connector.js";

export interface TokenValidationResult {
  valid: boolean;
  error?: string;
  userData?: UserTokenData;
}

export interface UserTokenData {
  userId: string;
  email: string;
  name: string;
}

interface CacheEntry {
  readonly data: UserTokenData;
  readonly expiry: number;
}

export class TokenValidator {
  private readonly d1Connector: D1Connector;
  private readonly tokenCache = new Map<string, CacheEntry>();
  private readonly cacheTimeout = 300_000; // 5 minutes in milliseconds
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(d1Config: CloudflareD1Config) {
    this.d1Connector = new D1Connector(d1Config);

    // Start cache cleanup with proper cleanup on destruction
    this.cleanupInterval = setInterval(
      () => this.cleanupExpiredCache(),
      60_000
    );
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.tokenCache.clear();
  }

  /**
   * Validate MCP token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Fast cache lookup
      const cached = this.getCachedToken(token);
      if (cached) {
        return { valid: true, userData: cached };
      }

      // Validate token format
      if (!this.isValidTokenFormat(token)) {
        return { valid: false, error: "Invalid token format" };
      }

      // Query database
      const userData = await this.getUserDataFromD1(token);
      if (!userData) {
        return { valid: false, error: "Token not found" };
      }

      // Non-blocking async operations
      this.updateTokenLastUsedAsync(token);
      this.cacheToken(token, userData);

      return { valid: true, userData };
    } catch (error) {
      logger.error("Token validation failed", {
        error: error instanceof Error ? error.message : String(error),
        tokenPrefix: `${token.substring(0, 8)}...`,
      });
      return { valid: false, error: "Validation failed" };
    }
  }

  /**
   * Modern token format validation
   */
  private isValidTokenFormat(token: string): boolean {
    return /^at_[a-f0-9]{32}$/.test(token);
  }

  /**
   * Get cached token with expiry check
   */
  private getCachedToken(token: string): UserTokenData | null {
    const cached = this.tokenCache.get(token);
    if (cached && Date.now() < cached.expiry) {
      logger.debug("Token validation from cache", {
        userId: cached.data.userId,
      });
      return cached.data;
    }
    return null;
  }

  /**
   * Cache token with expiry
   */
  private cacheToken(token: string, userData: UserTokenData): void {
    this.tokenCache.set(token, {
      data: userData,
      expiry: Date.now() + this.cacheTimeout,
    });
  }

  /**
   * Get user data from D1 database
   */
  private async getUserDataFromD1(
    token: string
  ): Promise<UserTokenData | null> {
    try {
      const result = await this.d1Connector.query(
        `SELECT
           u.id as user_id,
           u.email,
           u.name
         FROM mcp_tokens t
         JOIN users u ON t.user_id = u.id
         WHERE t.mcp_token = ?`,
        [token]
      );

      if (!result.success || !result.results || result.results.length === 0) {
        return null;
      }

      const row = result.results[0] as Record<string, unknown>;
      return {
        userId: row.user_id as string,
        email: (row.email as string) || "unknown",
        name: (row.name as string) || "unknown",
      };
    } catch (error) {
      logger.warn("D1 user data lookup failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Non-blocking token usage update
   */
  private updateTokenLastUsedAsync(token: string): void {
    // Fire and forget - don't block validation response
    this.d1Connector
      .query(
        "UPDATE mcp_tokens SET last_used_at = datetime('now') WHERE mcp_token = ?",
        [token]
      )
      .catch((error) => {
        logger.warn("Failed to update token last_used_at", {
          error: error instanceof Error ? error.message : String(error),
          tokenPrefix: `${token.substring(0, 8)}...`,
        });
      });
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, cached] of this.tokenCache.entries()) {
      if (now >= cached.expiry) {
        this.tokenCache.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug("Cleaned up expired token cache entries", {
        count: cleaned,
      });
    }
  }

  /**
   * Get user data by user ID
   */
  async getUserData(userId: string): Promise<UserTokenData> {
    try {
      const result = await this.d1Connector.query(
        "SELECT id, email, name FROM users WHERE id = ?",
        [userId]
      );

      if (!result.success || !result.results || result.results.length === 0) {
        throw new Error("User not found");
      }

      const user = result.results[0];

      return {
        userId: user.id as string,
        email: user.email as string,
        name: (user.name as string) || (user.email as string).split("@")[0],
      };
    } catch (error) {
      logger.error("Failed to get user data", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
