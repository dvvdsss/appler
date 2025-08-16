/**
 * Modern Rate Limiting Service
 * Implements subscription-based rate limiting for MCP server
 */

import { D1Connector } from "./d1-connector.js";
import { AuthContext } from "../auth/auth-middleware.js";
import { logger } from "../logger.js";

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

interface PlanLimits {
  weeklyQueries: number;
  requestsPerMinute: number;
}

export class RateLimitService {
  private d1Connector: D1Connector;

  constructor(d1Connector: D1Connector) {
    this.d1Connector = d1Connector;
  }

  /**
   * Check rate limits for a user
   */
  async checkLimits(
    clientIP: string,
    authContext: AuthContext
  ): Promise<RateLimitResult> {
    try {
      // Determine user identifier and plan type
      const { identifier, planType } = await this.getUserInfo(
        clientIP,
        authContext
      );

      // Get plan limits
      const limits = this.getPlanLimits(planType);

      // Check weekly and minute limits
      const [weeklyUsage, minuteUsage] = await Promise.all([
        this.getWeeklyUsage(identifier, clientIP),
        this.getMinuteUsage(identifier, clientIP),
      ]);

      // Determine if request is allowed
      const weeklyAllowed =
        limits.weeklyQueries === -1 || weeklyUsage < limits.weeklyQueries;
      const minuteAllowed =
        limits.requestsPerMinute === -1 ||
        minuteUsage < limits.requestsPerMinute;
      const allowed = weeklyAllowed && minuteAllowed;

      // Calculate remaining and reset time
      const weeklyRemaining =
        limits.weeklyQueries === -1
          ? -1
          : Math.max(0, limits.weeklyQueries - weeklyUsage);

      const minuteRemaining =
        limits.requestsPerMinute === -1
          ? -1
          : Math.max(0, limits.requestsPerMinute - minuteUsage);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()));
      nextWeek.setHours(0, 0, 0, 0);

      const nextMinute = new Date();
      nextMinute.setMinutes(nextMinute.getMinutes() + 1, 0, 0);

      // Determine which limit was hit
      const limitType = !minuteAllowed ? "minute" : "weekly";

      const result: RateLimitResult = {
        allowed,
        limit: limits.weeklyQueries,
        remaining: weeklyRemaining,
        resetAt: nextWeek.toISOString(),
        planType,
        limitType,
        minuteLimit: limits.requestsPerMinute,
        minuteRemaining,
        minuteResetAt: nextMinute.toISOString(),
      };

      if (!allowed) {
        logger.info("Rate limit exceeded", {
          identifier,
          planType,
          weeklyUsage,
          minuteUsage,
          limits,
          clientIP,
        });
      }

      return result;
    } catch (error) {
      logger.error("Rate limit check failed", {
        error: error instanceof Error ? error.message : String(error),
        clientIP,
        authenticated: authContext.isAuthenticated,
      });

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
   * Get user identifier and plan type
   */
  private async getUserInfo(
    clientIP: string,
    authContext: AuthContext
  ): Promise<{ identifier: string; planType: string }> {
    if (authContext.isAuthenticated && authContext.userData) {
      const planType = await this.getUserPlanType(authContext.userData.userId);
      return {
        identifier: authContext.userData.userId,
        planType,
      };
    } else {
      return {
        identifier: `anon_${clientIP}`,
        planType: "hobby",
      };
    }
  }

  /**
   * Get user's subscription plan type
   */
  private async getUserPlanType(userId: string): Promise<string> {
    try {
      const result = await this.d1Connector.query(
        `SELECT us.plan_type 
         FROM user_subscriptions us 
         WHERE us.user_id = ? 
         AND us.status = 'active'
         LIMIT 1`,
        [userId]
      );

      return result.results?.[0]?.plan_type || "hobby";
    } catch (error) {
      logger.error("Failed to get user plan type", {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return "hobby"; // Default to hobby plan on error
    }
  }

  /**
   * Get weekly usage count
   */
  private async getWeeklyUsage(
    identifier: string,
    clientIP: string
  ): Promise<number> {
    try {
      const result = await this.d1Connector.query(
        `SELECT COUNT(*) as count
         FROM usage_logs
         WHERE (user_id = ? OR ip_address = ?)
         AND created_at >= date('now', 'weekday 0', '-6 days')`,
        [identifier, clientIP]
      );

      return result.results?.[0]?.count || 0;
    } catch (error) {
      logger.error("Failed to get weekly usage", {
        error: error instanceof Error ? error.message : String(error),
        identifier,
        clientIP,
      });
      return 0;
    }
  }

  /**
   * Get minute usage count
   */
  private async getMinuteUsage(
    identifier: string,
    clientIP: string
  ): Promise<number> {
    try {
      const result = await this.d1Connector.query(
        `SELECT COUNT(*) as count 
         FROM usage_logs 
         WHERE (user_id = ? OR ip_address = ?) 
         AND created_at > datetime('now', '-1 minute')`,
        [identifier, clientIP]
      );

      return result.results?.[0]?.count || 0;
    } catch (error) {
      logger.error("Failed to get minute usage", {
        error: error instanceof Error ? error.message : String(error),
        identifier,
        clientIP,
      });
      return 0;
    }
  }

  /**
   * Get plan limits based on plan type
   */
  private getPlanLimits(planType: string): PlanLimits {
    switch (planType) {
      case "hobby":
        return {
          weeklyQueries: 10,
          requestsPerMinute: 1,
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
        logger.warn("Unknown plan type, defaulting to hobby", { planType });
        return {
          weeklyQueries: 10,
          requestsPerMinute: 1,
        };
    }
  }
}
