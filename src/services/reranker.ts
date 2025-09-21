/**
 * Modern SiliconFlow Reranker Service - MCP Optimized
 * High-performance document reranking with unified multi-key failover
 */

import { logger } from "../utils/logger.js";
import { SiliconFlowService } from "./siliconflow-base.js";
import { SILICONFLOW_CONFIG } from "./siliconflow-config.js";

interface RerankerInput {
  query: string;
  documents: string[];
  topN: number;
}

interface RerankerPayload {
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

export class RerankerService extends SiliconFlowService<
  RerankerInput,
  RerankerResponse,
  RankedDocument[]
> {
  protected readonly endpoint = "/rerank";

  /**
   * Rerank documents based on query relevance with multi-key failover
   */
  async rerank(
    query: string,
    documents: string[],
    topN: number
  ): Promise<RankedDocument[]> {
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

    const input: RerankerInput = {
      query: query.trim(),
      documents,
      topN: validTopN,
    };

    return this.callWithFailover(input, "Document reranking");
  }

  /**
   * Build API payload from input
   */
  protected buildPayload(input: RerankerInput): RerankerPayload {
    return {
      model: SILICONFLOW_CONFIG.RERANKER_MODEL,
      query: input.query,
      documents: input.documents,
      instruction: SILICONFLOW_CONFIG.RERANKER_INSTRUCTION,
      top_n: input.topN,
      return_documents: true,
    };
  }

  /**
   * Process API response and return ranked documents
   */
  protected processResponse(response: RerankerResponse): RankedDocument[] {
    if (!response.results || response.results.length === 0) {
      throw new Error("No reranking results received from SiliconFlow API");
    }

    return response.results.map((item) => ({
      content: item.document.text,
      originalIndex: item.index,
      relevanceScore: item.relevance_score,
    }));
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
      logger.error(
        `Reranker health check failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }
}
