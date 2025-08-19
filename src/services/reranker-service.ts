/**
 * Modern SiliconFlow Reranker Service
 * High-performance document reranking with Qwen3-Reranker-8B
 */

import { logger } from "../logger.js";
import type { AppConfig } from "../types/env.js";

export interface RerankerConfig {
  apiKey: string;
  apiUrl: string;
  model: "Qwen/Qwen3-Reranker-8B";
  instruction: "Please rerank the documents based on the query.";
  timeout: number;
}

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
  private config: RerankerConfig;

  constructor(appConfig: AppConfig) {
    this.config = {
      apiKey: appConfig.SILICONFLOW_API_KEY,
      apiUrl: "https://api.siliconflow.cn/v1/rerank",
      model: "Qwen/Qwen3-Reranker-8B",
      instruction: "Please rerank the documents based on the query.",
      timeout: appConfig.SILICONFLOW_TIMEOUT * 1000,
    };

    if (!this.config.apiKey) {
      throw new Error("SILICONFLOW_API_KEY is required for reranker service");
    }

    logger.info("Reranker service initialized", {
      model: this.config.model,
      timeout: this.config.timeout,
    });
  }

  /**
   * Rerank documents based on query relevance
   */
  async rerank(
    query: string,
    documents: string[],
    topN: number
  ): Promise<RankedDocument[]> {
    const rerankerStart = Date.now();
    console.log(
      `🔄 Reranker Started: "${query.substring(0, 50)}..." with ${documents.length} documents`
    );

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
      model: this.config.model,
      query: query.trim(),
      documents,
      instruction: this.config.instruction,
      top_n: validTopN,
      return_documents: true,
    };

    const headers = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Apple-RAG-MCP/2.0.0",
    };

    try {
      const requestStart = Date.now();
      console.log(`📡 SiliconFlow Reranker API Request Started...`);

      const response = await fetch(this.config.apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      console.log(
        `📡 SiliconFlow Reranker API Response Received (${Date.now() - requestStart}ms)`
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(
          `SiliconFlow Reranker API error ${response.status}: ${errorText}`
        );
      }

      const parseStart = Date.now();
      const result = (await response.json()) as RerankerResponse;

      if (!result.results || result.results.length === 0) {
        throw new Error("No reranking results received from SiliconFlow API");
      }

      console.log(
        `📊 Reranker Response Parsed: ${result.results.length} results (${Date.now() - parseStart}ms)`
      );

      // Transform results to our format
      const mappingStart = Date.now();
      const rankedDocuments: RankedDocument[] = result.results.map((item) => ({
        content: item.document.text,
        originalIndex: item.index,
        relevanceScore: item.relevance_score,
      }));

      console.log(`🔄 Results Mapped (${Date.now() - mappingStart}ms)`);
      console.log(
        `✅ Reranker Completed: ${rankedDocuments.length} results (${Date.now() - rerankerStart}ms)`
      );

      // Log token usage
      if (result.tokens) {
        logger.info("Reranker token usage", {
          inputTokens: result.tokens.input_tokens,
          outputTokens: result.tokens.output_tokens,
          totalTokens: result.tokens.input_tokens + result.tokens.output_tokens,
        });
      }

      return rankedDocuments;
    } catch (error) {
      console.log(
        `❌ Reranker Failed: ${error instanceof Error ? error.message : "Unknown error"} (${Date.now() - rerankerStart}ms)`
      );

      if (error instanceof Error) {
        throw new Error(`Reranking failed: ${error.message}`);
      }
      throw new Error("Reranking failed: Unknown error");
    }
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
