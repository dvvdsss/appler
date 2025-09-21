/**
 * SiliconFlow API Key Manager - MCP Optimized
 * Multi-key failover without caching for single-execution MCP tools
 */

export class SiliconFlowKeyManager {
  constructor(private readonly db: D1Database) {}

  /**
   * Get current available API key (no caching for MCP)
   */
  async getCurrentKey(): Promise<string> {
    const result = await this.db
      .prepare(
        "SELECT api_key FROM siliconflow_api_keys ORDER BY id ASC LIMIT 1"
      )
      .first();

    if (!result) {
      throw new Error("No SiliconFlow API keys available");
    }

    return result.api_key as string;
  }

  /**
   * Remove invalid API key
   */
  async removeKey(key: string): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM siliconflow_api_keys WHERE api_key = ?")
      .bind(key)
      .run();

    return result.success && result.meta.changes > 0;
  }

  /**
   * Check if error indicates invalid API key
   */
  isApiKeyError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("401") ||
      msg.includes("403") ||
      msg.includes("unauthorized") ||
      msg.includes("invalid api key")
    );
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("503") ||
      msg.includes("504") ||
      msg.includes("timeout") ||
      msg.includes("network") ||
      error.name === "AbortError"
    );
  }
}
