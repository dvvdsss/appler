/**
 * Modern Rate Limiting Service
 * Implements subscription-based rate limiting for MCP server
 */

import type { AuthContext } from "../types/index.js";
import { logger } from "../utils/logger.js";

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  planType: string;
  limitType: "weekly" | "minute"; // Which limit was hit
  minuteLimit?: number;
  minuteRemaining?: number;
  minuteResetAt?: string;
}

interface PlanLimits extends Record<string, unknown> {
  weeklyQueries: number;
  requestsPerMinute: number;
}

export class RateLimitService {
  private d1: D1Database;

  constructor(d1: D1Database) {
    this.d1 = d1;
  }

  /**
   * Check rate limits for a user
   */
  async checkLimits(
    clientIP: string,
    authContext: AuthContext
  ): Promise<RateLimitResult> {
    try {
      // Get user identifier and plan type (handles all auth types)
      const { identifier, planType } = await this.getUserInfo(
        clientIP,
        authContext
      );

      // Get plan limits
      const limits = this.getPlanLimits(planType);

      // Check weekly and minute limits in parallel
      const [weeklyUsage, minuteUsage] = await Promise.all([
        this.getWeeklyUsage(identifier),
        this.getMinuteUsage(identifier),
      ]);

      // Determine if request is allowed
      const weeklyAllowed =
        limits.weeklyQueries === -1 || weeklyUsage < limits.weeklyQueries;
      const minuteAllowed =
        limits.requestsPerMinute === -1 ||
        minuteUsage < limits.requestsPerMinute;
      const allowed = weeklyAllowed && minuteAllowed;

      // Calculate remaining quotas
      const weeklyRemaining =
        limits.weeklyQueries === -1
          ? -1
          : Math.max(0, limits.weeklyQueries - weeklyUsage);
      const minuteRemaining =
        limits.requestsPerMinute === -1
          ? -1
          : Math.max(0, limits.requestsPerMinute - minuteUsage);

      // Determine which limit was hit
      const limitType = !minuteAllowed ? "minute" : "weekly";

      const result: RateLimitResult = {
        allowed,
        limit: limits.weeklyQueries,
        remaining: weeklyRemaining,
        resetAt: this.getWeeklyResetTime(),
        planType,
        limitType,
        minuteLimit: limits.requestsPerMinute,
        minuteRemaining,
        minuteResetAt: this.getMinuteResetTime(),
      };

      if (!allowed) {
        logger.info(
          `Rate limit exceeded for ${identifier} (planType: ${planType}, weeklyUsage: ${weeklyUsage}, minuteUsage: ${minuteUsage}, clientIP: ${clientIP})`
        );
      }

      return result;
    } catch (error) {
      logger.error(
        `Rate limit check failed for ${clientIP} (authenticated: ${authContext.isAuthenticated}): ${error instanceof Error ? error.message : String(error)}`
      );

      // Fail open - allow request if rate limit check fails
      return {
        allowed: true,
        limit: -1,
        remaining: -1,
        resetAt: new Date().toISOString(),
        planType: "unknown",
        limitType: "weekly",
        minuteLimit: -1,
        minuteRemaining: -1,
        minuteResetAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Get user identifier and plan type - handles all authentication scenarios
   */
  private async getUserInfo(
    clientIP: string,
    authContext: AuthContext
  ): Promise<{ identifier: string; planType: string }> {
    // Handle authenticated users (token or IP-based)
    if (authContext.isAuthenticated && authContext.userId) {
      const planType = await this.getUserPlanType(authContext.userId);
      return {
        identifier: authContext.userId,
        planType,
      };
    }

    // Fallback: anonymous user
    return {
      identifier: `anon_${clientIP}`,
      planType: "hobby",
    };
  }

  /**
   * Get user's subscription plan type
   */
  private async getUserPlanType(userId: string): Promise<string> {
    try {
      const result = await this.d1
        .prepare(
          `SELECT us.plan_type
         FROM user_subscriptions us
         WHERE us.user_id = ?
         AND us.status = 'active'
         LIMIT 1`
        )
        .bind(userId)
        .all();

      return (result.results?.[0]?.plan_type as string) || "hobby";
    } catch (error) {
      logger.error(
        `Failed to get user plan type for ${userId}: ${error instanceof Error ? error.message : String(error)}`
      );
      return "hobby"; // Default to hobby plan on error
    }
  }

  /**
   * Get weekly usage count from both search_logs and fetch_logs
   * Excludes rate-limited requests (status_code = 429) to prevent vicious cycles
   */
  private async getWeeklyUsage(identifier: string): Promise<number> {
    try {
      const weekStart = this.getWeekStartTime().toISOString();

      // Single optimized query to get combined count, only counting successful requests
      const result = await this.d1
        .prepare(
          `SELECT 
            (SELECT COUNT(*) FROM search_logs WHERE user_id = ? AND created_at >= ? AND status_code = 200) +
            (SELECT COUNT(*) FROM fetch_logs WHERE user_id = ? AND created_at >= ? AND status_code = 200) as total_count`
        )
        .bind(identifier, weekStart, identifier, weekStart)
        .first();

      const count = (result?.total_count as number) || 0;

      // Debug logging to verify the fix is working
      logger.info(
        `DEBUG: Weekly usage for ${identifier}: ${count} (only status_code=200, since: ${weekStart})`
      );

      return count;
    } catch (error) {
      logger.error(
        `Failed to get weekly usage for ${identifier}: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }

  /**
   * Get minute usage count from both search_logs and fetch_logs
   * Excludes rate-limited requests (status_code = 429) to prevent vicious cycles
   */
  private async getMinuteUsage(identifier: string): Promise<number> {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();

      // Single optimized query to get combined count, only counting successful requests
      const result = await this.d1
        .prepare(
          `SELECT 
            (SELECT COUNT(*) FROM search_logs WHERE user_id = ? AND created_at > ? AND status_code = 200) +
            (SELECT COUNT(*) FROM fetch_logs WHERE user_id = ? AND created_at > ? AND status_code = 200) as total_count`
        )
        .bind(identifier, oneMinuteAgo, identifier, oneMinuteAgo)
        .first();

      const count = (result?.total_count as number) || 0;

      // Debug logging to verify the fix is working
      logger.info(
        `DEBUG: Minute usage for ${identifier}: ${count} (only status_code=200, window: ${oneMinuteAgo} to now)`
      );

      return count;
    } catch (error) {
      logger.error(
        `Failed to get minute usage for ${identifier}: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }

  /**
   * Get start of current week (Sunday 00:00:00)
   */
  private getWeekStartTime(): Date {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
  }

  /**
   * Get weekly reset time (next Sunday 00:00:00)
   */
  private getWeeklyResetTime(): string {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + (7 - now.getDay()));
    nextWeek.setHours(0, 0, 0, 0);
    return nextWeek.toISOString();
  }

  /**
   * Get minute reset time (next minute 00 seconds)
   */
  private getMinuteResetTime(): string {
    const now = new Date();
    const nextMinute = new Date(now);
    nextMinute.setSeconds(0, 0);
    nextMinute.setMinutes(nextMinute.getMinutes() + 1);
    return nextMinute.toISOString();
  }

  /**
   * Get plan limits based on plan type
   */
  private getPlanLimits(planType: string): PlanLimits {
    switch (planType) {
      case "hobby":
        return {
          weeklyQueries: 10,
          requestsPerMinute: 2,
        };
      case "pro":
        return {
          weeklyQueries: 10000,
          requestsPerMinute: 20,
        };
      case "enterprise":
        return {
          weeklyQueries: -1, // unlimited
          requestsPerMinute: -1, // unlimited
        };
      default:
        logger.warn(`Unknown plan type ${planType}, defaulting to hobby`);
        return {
          weeklyQueries: 10,
          requestsPerMinute: 2,
        };
    }
  }
}
