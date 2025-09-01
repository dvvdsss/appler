/**
 * IP Authentication Service
 * Centralized service for IP-based user authentication and management
 */

import { logger } from "../utils/logger.js";

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
  constructor(private d1: D1Database) {}

  /**
   * Check if IP is authorized for a user (with full user data including plan)
   * Used by rate-limit service for comprehensive authentication
   */
  async authenticateIP(
    clientIP: string
  ): Promise<IPAuthenticationResult | null> {
    try {
      // Query database for authorized IP with user and subscription data
      const result = await this.d1
        .prepare(
          `SELECT uai.user_id, u.email, u.name,
                COALESCE(us.plan_type, 'hobby') as plan_type
         FROM user_authorized_ips uai
         JOIN users u ON uai.user_id = u.id
         LEFT JOIN user_subscriptions us ON u.id = us.user_id
         WHERE uai.ip_address = ?`
        )
        .bind(clientIP)
        .all();

      if (!result.results || result.results.length === 0) {
        return null;
      }

      const user = result.results[0] as unknown as UserRecord;

      // Update last_used_at in background
      await this.updateIPLastUsedAsync(clientIP, user.user_id);

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
      // Query database for authorized IP with basic user data
      const result = await this.d1
        .prepare(
          `SELECT uai.user_id, u.email, u.name
         FROM user_authorized_ips uai
         JOIN users u ON uai.user_id = u.id
         WHERE uai.ip_address = ?`
        )
        .bind(clientIP)
        .all();

      if (!result.results || result.results.length === 0) {
        return null;
      }

      const user = result.results[0] as unknown as UserRecord;

      // Update last_used_at in background
      await this.updateIPLastUsedAsync(clientIP, user.user_id);

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
  private async updateIPLastUsedAsync(
    ipAddress: string,
    userId: string
  ): Promise<void> {
    try {
      const result = await this.d1
        .prepare(
          "UPDATE user_authorized_ips SET last_used_at = ? WHERE ip_address = ? AND user_id = ?"
        )
        .bind(new Date().toISOString(), ipAddress, userId)
        .run();

      if (!result.success) {
        throw new Error("D1 IP update execution failed");
      }
    } catch (error) {
      logger.error("❌ Failed to update IP last_used_at", {
        ipAddress,
        userId: `${userId.substring(0, 8)}...`,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // 不重新抛出错误，避免影响主流程
    }
  }
}
