/**
 * Modern Usage Logger - Separated Search and Fetch Logging
 * Optimal solution with dedicated tables for different operation types
 */
import { logger } from "../logger.js";
import { type CloudflareD1Config, D1Connector } from "./d1-connector.js";

export interface SearchLogEntry {
  userId: string;
  mcpToken?: string;
  searchQuery: string;
  resultCount: number;
  responseTimeMs: number;
  statusCode?: number;
  errorCode?: string;
  ipAddress?: string;
}

export interface FetchLogEntry {
  userId: string;
  mcpToken?: string;
  requestedUrl: string;
  actualUrl?: string;
  pageId?: string;
  responseTimeMs: number;
  statusCode?: number;
  errorCode?: string;
  ipAddress?: string;
}

export class UsageLogger {
  private d1Connector: D1Connector;

  constructor(d1Config?: CloudflareD1Config) {
    if (!d1Config) {
      throw new Error("CloudflareD1Config is required for UsageLogger");
    }
    this.d1Connector = new D1Connector(d1Config);
  }

  /**
   * Log search operation to D1 database (async, non-blocking)
   */
  async logSearch(entry: SearchLogEntry): Promise<void> {
    // Fire-and-forget logging to avoid blocking main query flow
    this.executeSearchLog(entry).catch((error) => {
      logger.warn("Search logging failed (non-blocking)", {
        error: error instanceof Error ? error.message : String(error),
        userId: entry.userId,
        mcpToken: entry.mcpToken
          ? `${entry.mcpToken.substring(0, 8)}...`
          : "anonymous",
        query: `${entry.searchQuery.substring(0, 50)}...`,
      });
    });
  }

  /**
   * Log fetch operation to D1 database (async, non-blocking)
   */
  async logFetch(entry: FetchLogEntry): Promise<void> {
    // Fire-and-forget logging to avoid blocking main query flow
    this.executeFetchLog(entry).catch((error) => {
      logger.warn("Fetch logging failed (non-blocking)", {
        error: error instanceof Error ? error.message : String(error),
        userId: entry.userId,
        mcpToken: entry.mcpToken
          ? `${entry.mcpToken.substring(0, 8)}...`
          : "anonymous",
        url: entry.requestedUrl,
      });
    });
  }

  /**
   * Execute search log operation with environment-aware connection
   */
  private async executeSearchLog(entry: SearchLogEntry): Promise<void> {
    try {
      const result = await this.d1Connector.query(
        `INSERT INTO search_logs
         (user_id, mcp_token, search_query, result_count, response_time_ms, status_code, error_code, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.userId,
          entry.mcpToken,
          entry.searchQuery,
          entry.resultCount,
          entry.responseTimeMs,
          entry.statusCode,
          entry.errorCode || null,
          entry.ipAddress || null,
        ]
      );

      if (!result.success) {
        throw new Error("D1 search log execution failed");
      }

      logger.debug("Search logged successfully", {
        userId: entry.userId,
        mcpToken: entry.mcpToken
          ? `${entry.mcpToken.substring(0, 8)}...`
          : "anonymous",
        query: `${entry.searchQuery.substring(0, 50)}...`,
        resultCount: entry.resultCount,
        responseTime: entry.responseTimeMs,
        environment: process.env.NODE_ENV || "development",
      });
    } catch (error) {
      // Re-throw for caller's catch block
      throw new Error(
        `D1 search logging failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute fetch log operation with environment-aware connection
   */
  private async executeFetchLog(entry: FetchLogEntry): Promise<void> {
    try {
      const result = await this.d1Connector.query(
        `INSERT INTO fetch_logs
         (user_id, mcp_token, requested_url, actual_url, page_id, response_time_ms, status_code, error_code, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.userId,
          entry.mcpToken,
          entry.requestedUrl,
          entry.actualUrl || null,
          entry.pageId || null,
          entry.responseTimeMs,
          entry.statusCode,
          entry.errorCode || null,
          entry.ipAddress || null,
        ]
      );

      if (!result.success) {
        throw new Error("D1 fetch log execution failed");
      }

      logger.debug("Fetch logged successfully", {
        userId: entry.userId,
        mcpToken: entry.mcpToken
          ? `${entry.mcpToken.substring(0, 8)}...`
          : "anonymous",
        requestedUrl: entry.requestedUrl,
        actualUrl: entry.actualUrl,
        responseTime: entry.responseTimeMs,
        environment: process.env.NODE_ENV || "development",
      });
    } catch (error) {
      // Re-throw for caller's catch block
      throw new Error(
        `D1 fetch logging failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }


}
