/**
 * Ultra-Modern D1 Database Connector
 * High-performance, type-safe Cloudflare D1 REST API client
 */
import { logger } from "../logger.js";

export interface D1QueryResult<T = Record<string, unknown>> {
  readonly results: T[];
  readonly success: boolean;
  readonly meta?: {
    readonly duration: number;
    readonly rows_read: number;
    readonly rows_written: number;
  };
}

export interface CloudflareD1Config {
  readonly accountId: string;
  readonly apiToken: string;
  readonly databaseId: string;
}

interface D1ApiResponse {
  readonly result: Array<{
    readonly results: Record<string, unknown>[];
    readonly success: boolean;
    readonly meta?: Record<string, unknown>;
  }>;
  readonly errors?: Array<{
    readonly code: number;
    readonly message: string;
  }>;
}

/**
 * Ultra-modern D1 database connector with advanced features
 */
export class D1Connector {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: CloudflareD1Config) {
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}`;
    this.defaultHeaders = {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
      "User-Agent": "apple-rag-mcp/2.0.0",
    };

    logger.info("Ultra-modern D1Connector initialized", {
      environment: process.env.NODE_ENV || "development",
      databaseId: `${config.databaseId.substring(0, 8)}...`,
      method: "REST API (Cloudflare official)",
      features: ["type-safe", "high-performance", "error-resilient"],
    });
  }

  /**
   * Execute optimized SQL query with advanced error handling
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = []
  ): Promise<D1QueryResult<T>> {
    const startTime = performance.now();

    try {
      const response = await this.executeRequest(sql, params);
      const data = await this.parseResponse(response);

      const duration = performance.now() - startTime;

      logger.debug("D1 query executed successfully", {
        duration: `${duration.toFixed(2)}ms`,
        resultCount: data.results.length,
        sqlPreview: sql.substring(0, 50) + (sql.length > 50 ? "..." : ""),
      });

      return data as D1QueryResult<T>;
    } catch (error) {
      const duration = performance.now() - startTime;

      logger.error("D1 query failed", {
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration.toFixed(2)}ms`,
        sql: sql.substring(0, 100) + (sql.length > 100 ? "..." : ""),
        paramsCount: params.length,
        environment: process.env.NODE_ENV || "development",
      });

      throw error;
    }
  }

  /**
   * Execute HTTP request to D1 API
   */
  private async executeRequest(
    sql: string,
    params: readonly unknown[]
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/query`, {
      method: "POST",
      headers: this.defaultHeaders,
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `D1 API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response;
  }

  /**
   * Parse D1 API response with type safety
   */
  private async parseResponse<T>(
    response: Response
  ): Promise<D1QueryResult<T>> {
    const data = (await response.json()) as D1ApiResponse;

    if (data.errors?.length) {
      const error = data.errors[0];
      throw new Error(`D1 API error: ${error.code} - ${error.message}`);
    }

    const result = data.result?.[0];
    if (!result) {
      throw new Error("Invalid D1 API response: missing result");
    }

    return {
      results: result.results as T[],
      success: result.success,
      meta: result.meta as
        | {
            readonly duration: number;
            readonly rows_read: number;
            readonly rows_written: number;
          }
        | undefined,
    };
  }

  /**
   * Advanced database connection test with health metrics
   */
  async testConnection(): Promise<boolean> {
    const startTime = performance.now();

    try {
      const result = await this.query<{ test: number }>("SELECT 1 as test");
      const duration = performance.now() - startTime;

      const isHealthy =
        result.success &&
        result.results.length > 0 &&
        result.results[0].test === 1;

      logger.info("Database connection test completed", {
        healthy: isHealthy,
        duration: `${duration.toFixed(2)}ms`,
        resultCount: result.results.length,
        environment: process.env.NODE_ENV || "development",
      });

      return isHealthy;
    } catch (error) {
      const duration = performance.now() - startTime;

      logger.error("Database connection test failed", {
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration.toFixed(2)}ms`,
        environment: process.env.NODE_ENV || "development",
      });

      return false;
    }
  }

  /**
   * Get database statistics and health metrics
   */
  async getDatabaseStats(): Promise<{
    readonly healthy: boolean;
    readonly responseTime: number;
    readonly timestamp: string;
  }> {
    const startTime = performance.now();

    try {
      await this.testConnection();
      const responseTime = performance.now() - startTime;

      return {
        healthy: true,
        responseTime: Math.round(responseTime * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    } catch (_error) {
      const responseTime = performance.now() - startTime;

      return {
        healthy: false,
        responseTime: Math.round(responseTime * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute multiple queries in a transaction-like manner
   */
  async executeTransaction<T = Record<string, unknown>>(
    queries: Array<{
      readonly sql: string;
      readonly params?: readonly unknown[];
    }>
  ): Promise<D1QueryResult<T>[]> {
    const results: D1QueryResult<T>[] = [];

    for (const { sql, params = [] } of queries) {
      const result = await this.query<T>(sql, params);
      results.push(result);

      if (!result.success) {
        throw new Error(
          `Transaction failed at query: ${sql.substring(0, 50)}...`
        );
      }
    }

    logger.info("Transaction completed successfully", {
      queryCount: queries.length,
      totalResults: results.reduce((sum, r) => sum + r.results.length, 0),
    });

    return results;
  }
}
