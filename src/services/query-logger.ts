/**
 * Environment-aware D1 Query Logger - Global Optimal Solution
 * Minimal overhead, zero redundancy, environment-aware database connection
 */
import { logger } from "../logger.js";
import { D1Connector, CloudflareD1Config } from "./d1-connector.js";

export interface QueryLogEntry {
  userId: string;
  mcpToken: string;
  queryText: string;
  resultCount: number;
  responseTimeMs: number;
  statusCode: number;
  ipAddress?: string;
}

export class QueryLogger {
  private d1Connector: D1Connector;

  constructor(d1Config?: CloudflareD1Config) {
    if (!d1Config) {
      throw new Error("CloudflareD1Config is required for QueryLogger");
    }
    this.d1Connector = new D1Connector(d1Config);
  }

  /**
   * Log RAG query to D1 database (async, non-blocking)
   */
  async logQuery(entry: QueryLogEntry): Promise<void> {
    // Fire-and-forget logging to avoid blocking main query flow
    this.executeLog(entry).catch((error) => {
      logger.warn("Query logging failed (non-blocking)", {
        error: error instanceof Error ? error.message : String(error),
        userId: entry.userId,
        mcpToken: entry.mcpToken.substring(0, 8) + "...",
        query: entry.queryText.substring(0, 50) + "...",
      });
    });
  }

  /**
   * Execute D1 logging operation with environment-aware connection
   */
  private async executeLog(entry: QueryLogEntry): Promise<void> {
    try {
      const result = await this.d1Connector.query(
        `INSERT INTO usage_logs
         (user_id, mcp_token, query_text, result_count, response_time_ms, status_code, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.userId,
          entry.mcpToken,
          entry.queryText,
          entry.resultCount,
          entry.responseTimeMs,
          entry.statusCode,
          entry.ipAddress || null,
        ]
      );

      if (!result.success) {
        throw new Error("D1 query execution failed");
      }

      logger.debug("Query logged successfully", {
        userId: entry.userId,
        mcpToken: entry.mcpToken.substring(0, 8) + "...",
        query: entry.queryText.substring(0, 50) + "...",
        resultCount: entry.resultCount,
        responseTime: entry.responseTimeMs,
        environment: process.env.NODE_ENV || "development",
      });
    } catch (error) {
      // Re-throw for caller's catch block
      throw new Error(
        `D1 logging failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Log anonymous query (for unauthenticated users)
   */
  async logAnonymousQuery(
    mcpToken: string,
    queryText: string,
    resultCount: number,
    responseTimeMs: number,
    statusCode: number,
    ipAddress?: string
  ): Promise<void> {
    await this.logQuery({
      userId: "anonymous",
      mcpToken,
      queryText,
      resultCount,
      responseTimeMs,
      statusCode,
      ipAddress,
    });
  }
}
