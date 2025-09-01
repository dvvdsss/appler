/**
 * Modern SiliconFlow Reranker Service
 * High-performance document reranking with Qwen3-Reranker-8B
 */

import type { AppConfig } from "../types/index.js";
import { logger } from "../utils/logger.js";

export interface RerankerRequest {
  model: "Qwen/Qwen3-Reranker-8B";
  query: string;
  documents: string[];
  instruction: "Please rerank the documents based on the query.";
  top_n: number;
  return_documents: true;
}

export interface RerankerResult {
  document: {
    text: string;
  };
  index: number;
  relevance_score: number;
}

export interface RerankerResponse {
  id: string;
  results: RerankerResult[];
  tokens: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface RankedDocument {
  content: string;
  originalIndex: number;
  relevanceScore: number;
}

export class RerankerService {
  private readonly apiUrl = "https://api.siliconflow.cn/v1/rerank";
  private readonly model = "Qwen/Qwen3-Reranker-8B";
  private readonly instruction =
    "Please rerank the documents based on the query.";

  constructor(private config: AppConfig) {
    if (!config.SILICONFLOW_API_KEY) {
      throw new Error("SILICONFLOW_API_KEY is required for reranker service");
    }
  }

  /**
   * Rerank documents based on query relevance
   */
  async rerank(
    query: string,
    documents: string[],
    topN: number
  ): Promise<RankedDocument[]> {
    const startTime = Date.now();
    if (!query?.trim()) {
      throw new Error("Query cannot be empty for reranking");
    }

    if (!documents || documents.length === 0) {
      throw new Error("Documents cannot be empty for reranking");
    }

    // Validate topN parameter
    const validTopN = Math.min(topN, documents.length);
    if (validTopN <= 0) {
      throw new Error("top_n must be greater than 0");
    }

    const payload: RerankerRequest = {
      model: this.model,
      query: query.trim(),
      documents,
      instruction: this.instruction,
      top_n: validTopN,
      return_documents: true,
    };

    const headers = {
      Authorization: `Bearer ${this.config.SILICONFLOW_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "Apple-RAG-MCP/2.0.0",
    };

    // Simple retry mechanism - max 2 retries, no delay
    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(this.apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.SILICONFLOW_TIMEOUT * 1000),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          const error = new Error(
            `SiliconFlow Reranker API error ${response.status}: ${errorText}`
          );

          // If this is the last attempt, throw the error
          if (attempt === maxRetries) {
            throw error;
          }

          // Store error and continue to next attempt
          lastError = error;
          continue;
        }

        const result = (await response.json()) as RerankerResponse;

        if (!result.results || result.results.length === 0) {
          throw new Error("No reranking results received from SiliconFlow API");
        }

        // Transform results to our format
        const rankedDocuments: RankedDocument[] = result.results.map(
          (item) => ({
            content: item.document.text,
            originalIndex: item.index,
            relevanceScore: item.relevance_score,
          })
        );

        const duration = Date.now() - startTime;
        console.log(
          `Rerank completed (${(duration / 1000).toFixed(1)}s): ${rankedDocuments.length} results`
        );

        return rankedDocuments;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Silent retry - errors will be logged if all attempts fail
      }
    }

    // This should never be reached, but just in case
    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Health check for reranker service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple test with minimal data
      const testResult = await this.rerank("test query", ["test document"], 1);
      return testResult.length > 0;
    } catch (error) {
      logger.error("Reranker health check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
