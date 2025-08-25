/**
 * IP Authentication Service
 * Centralized service for IP-based user authentication and management
 */

import { logger } from "../logger.js";
import { type CloudflareD1Config, D1Connector } from "./d1-connector.js";

interface UserRecord {
  user_id: string;
  email?: string;
  name?: string;
  plan_type: string;
  created_at: string;
  updated_at: string;
}

export interface IPAuthenticationResult {
  userId: string;
  email: string;
  name: string;
  planType: string;
}

export interface UserTokenData {
  userId: string;
  email: string;
  name: string;
}

/**
 * Centralized IP Authentication Service
 * Handles all IP-based authentication logic with caching and optimization
 */
export class IPAuthenticationService {
  private readonly d1Connector: D1Connector;

  // Cache for IP-based user lookups
  private readonly ipUserCache = new Map<
    string,
    {
      userId: string;
      email: string;
      name: string;
      planType: string;
      expiry: number;
    }
  >();

  private readonly cacheTimeout = 300_000; // 5 minutes

  constructor(d1Config: CloudflareD1Config) {
    this.d1Connector = new D1Connector(d1Config);
  }

  /**
   * Check if IP is authorized for a user (with full user data including plan)
   * Used by rate-limit-service for comprehensive authentication
   */
  async authenticateIP(
    clientIP: string
  ): Promise<IPAuthenticationResult | null> {
    try {
      // Check cache first
      const cached = this.ipUserCache.get(clientIP);
      if (cached && cached.expiry > Date.now()) {
        // Update last_used_at in background
        this.updateIPLastUsedAsync(clientIP, cached.userId);
        return {
          userId: cached.userId,
          email: cached.email,
          name: cached.name,
          planType: cached.planType,
        };
      }

      // Query database for authorized IP with user and subscription data
      const result = await this.d1Connector.query(
        `SELECT uai.user_id, u.email, u.name, 
                COALESCE(us.plan_type, 'hobby') as plan_type
         FROM user_authorized_ips uai
         JOIN users u ON uai.user_id = u.id
         LEFT JOIN user_subscriptions us ON u.id = us.user_id
         WHERE uai.ip_address = ?`,
        [clientIP]
      );

      if (!result.results || result.results.length === 0) {
        return null;
      }

      const user = result.results[0] as unknown as UserRecord;

      // Cache the result
      this.ipUserCache.set(clientIP, {
        userId: user.user_id,
        email: user.email || "ip-authenticated",
        name: user.name || "IP User",
        planType: user.plan_type,
        expiry: Date.now() + this.cacheTimeout,
      });

      // Update last_used_at in background
      this.updateIPLastUsedAsync(clientIP, user.user_id);

      return {
        userId: user.user_id,
        email: user.email || "ip-authenticated",
        name: user.name || "IP User",
        planType: user.plan_type,
      };
    } catch (error) {
      logger.error("IP authentication failed", {
        clientIP,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check if IP is authorized for a user (basic user data only)
   * Used by auth-middleware for simple authentication
   */
  async checkIPAuthentication(clientIP: string): Promise<UserTokenData | null> {
    try {
      // Try to get from cache first
      const cached = this.ipUserCache.get(clientIP);
      if (cached && cached.expiry > Date.now()) {
        // Update last_used_at in background
        this.updateIPLastUsedAsync(clientIP, cached.userId);
        return {
          userId: cached.userId,
          email: cached.email,
          name: cached.name,
        };
      }

      // Query database for authorized IP with basic user data
      const result = await this.d1Connector.query(
        `SELECT uai.user_id, u.email, u.name
         FROM user_authorized_ips uai
         JOIN users u ON uai.user_id = u.id
         WHERE uai.ip_address = ?`,
        [clientIP]
      );

      if (!result.results || result.results.length === 0) {
        return null;
      }

      const user = result.results[0] as unknown as UserRecord;

      // Update cache if not present (for future authenticateIP calls)
      if (!cached) {
        // We don't have plan_type here, so we'll let authenticateIP populate it later
        this.ipUserCache.set(clientIP, {
          userId: user.user_id,
          email: user.email || "ip-authenticated",
          name: user.name || "IP User",
          planType: "hobby", // Default, will be updated by authenticateIP if needed
          expiry: Date.now() + this.cacheTimeout,
        });
      }

      // Update last_used_at in background
      this.updateIPLastUsedAsync(clientIP, user.user_id);

      return {
        userId: user.user_id,
        email: user.email || "ip-authenticated",
        name: user.name || "IP User",
      };
    } catch (error) {
      logger.error("IP authentication check failed", {
        clientIP,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update IP last_used_at timestamp (non-blocking)
   * Private method used internally by both authentication methods
   */
  private updateIPLastUsedAsync(ipAddress: string, userId: string): void {
    this.d1Connector
      .query(
        "UPDATE user_authorized_ips SET last_used_at = ? WHERE ip_address = ? AND user_id = ?",
        [new Date().toISOString(), ipAddress, userId]
      )
      .catch((error) => {
        logger.error("Failed to update IP last_used_at", {
          ipAddress,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  /**
   * Clear cache for specific IP (useful for testing or manual cache invalidation)
   */
  clearIPCache(clientIP: string): void {
    this.ipUserCache.delete(clientIP);
  }

  /**
   * Clear all IP cache (useful for testing or system maintenance)
   */
  clearAllCache(): void {
    this.ipUserCache.clear();
  }

  /**
   * Get cache statistics (useful for monitoring)
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.ipUserCache.size,
      entries: Array.from(this.ipUserCache.keys()),
    };
  }
}
