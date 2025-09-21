/**
 * SiliconFlow Base Service - Abstract Template
 * Unified multi-key failover and retry logic for all SiliconFlow APIs
 */

import { logger } from "../utils/logger.js";
import { SiliconFlowKeyManager } from "./key-manager.js";
import { SILICONFLOW_CONFIG } from "./siliconflow-config.js";

export abstract class SiliconFlowService<TRequest, TResponse, TResult> {
  protected readonly keyManager: SiliconFlowKeyManager;
  protected abstract readonly endpoint: string;

  constructor(db: D1Database) {
    this.keyManager = new SiliconFlowKeyManager(db);
  }

  /**
   * Template method - unified API call with multi-key failover
   */
  protected async callWithFailover(
    input: TRequest,
    operationName: string
  ): Promise<TResult> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    // Try multiple API keys
    for (
      let keyAttempt = 0;
      keyAttempt < SILICONFLOW_CONFIG.MAX_KEY_ATTEMPTS;
      keyAttempt++
    ) {
      try {
        const apiKey = await this.keyManager.getCurrentKey();

        // Try API call with current key
        for (
          let retry = 0;
          retry < SILICONFLOW_CONFIG.MAX_RETRIES_PER_KEY;
          retry++
        ) {
          try {
            const response = await this.makeApiCall(input, apiKey);
            const result = this.processResponse(response);

            const duration = Date.now() - startTime;
            logger.info(
              `${operationName} completed (${(duration / 1000).toFixed(1)}s)`
            );

            return result;
          } catch (error) {
            lastError =
              error instanceof Error ? error : new Error(String(error));

            // If API key error, remove key and try next one
            if (this.keyManager.isApiKeyError(lastError)) {
              await this.keyManager.removeKey(apiKey);
              break; // Try next key
            }

            // If retryable error and not last retry, continue with same key
            if (
              this.keyManager.isRetryableError(lastError) &&
              retry < SILICONFLOW_CONFIG.MAX_RETRIES_PER_KEY - 1
            ) {
              const delay = Math.min(
                SILICONFLOW_CONFIG.RETRY_BASE_DELAY * 2 ** retry,
                SILICONFLOW_CONFIG.RETRY_MAX_DELAY
              );
              await this.sleep(delay);
              continue;
            }

            // Non-retryable error, throw immediately
            throw lastError;
          }
        }
      } catch (error) {
        if (
          (error as Error).message.includes("No SiliconFlow API keys available")
        ) {
          throw new Error("All SiliconFlow API keys exhausted");
        }
        lastError = error as Error;
      }
    }

    const duration = Date.now() - startTime;
    logger.error(
      `${operationName} failed (duration: ${duration}ms): ${String(lastError)}`
    );
    throw lastError || new Error(`${operationName} failed after all attempts`);
  }

  /**
   * Make HTTP request to SiliconFlow API
   */
  private async makeApiCall(
    input: TRequest,
    apiKey: string
  ): Promise<TResponse> {
    const payload = this.buildPayload(input);
    const headers = this.buildHeaders(apiKey);

    const response = await fetch(
      `${SILICONFLOW_CONFIG.BASE_URL}${this.endpoint}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(SILICONFLOW_CONFIG.TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
    }

    return (await response.json()) as TResponse;
  }

  /**
   * Build request headers
   */
  private buildHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": SILICONFLOW_CONFIG.USER_AGENT,
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Abstract methods to be implemented by subclasses
  protected abstract buildPayload(input: TRequest): unknown;
  protected abstract processResponse(response: TResponse): TResult;
}
