/**
 * Modern Embedding Service - Cloudflare Worker Native
 * Optimized SiliconFlow API integration with edge computing
 */

import type {
  AppConfig,
  EmbeddingService as IEmbeddingService,
} from "../types/index.js";
import { logger } from "../utils/logger.js";

interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

export class EmbeddingService implements IEmbeddingService {
  private readonly apiUrl = "https://api.siliconflow.cn/v1/embeddings";
  private readonly model = "Qwen/Qwen3-Embedding-4B";

  constructor(private config: AppConfig) {
    if (!config.SILICONFLOW_API_KEY) {
      throw new Error("SILICONFLOW_API_KEY is required");
    }
  }

  /**
   * Create embedding for text using SiliconFlow API
   */
  async createEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();

    if (!text?.trim()) {
      throw new Error("Text cannot be empty for embedding generation");
    }

    const trimmedText = text.trim();

    try {
      const response = await this.callSiliconFlowAPI(trimmedText);
      const embedding = this.extractEmbedding(response);
      return this.normalizeL2(embedding);
    } catch (error) {
      logger.error("Embedding generation failed", {
        error: String(error),
        textLength: trimmedText.length,
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Call SiliconFlow API
   */
  private async callSiliconFlowAPI(text: string): Promise<EmbeddingResponse> {
    const payload = {
      model: this.model,
      input: text,
      encoding_format: "float",
    };

    const headers = {
      Authorization: `Bearer ${this.config.SILICONFLOW_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "Apple-RAG-MCP/2.0.0",
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.config.SILICONFLOW_TIMEOUT * 1000
    );

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(
          `SiliconFlow API error ${response.status}: ${errorText}`
        );
      }

      return (await response.json()) as EmbeddingResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `SiliconFlow API timeout after ${this.config.SILICONFLOW_TIMEOUT}s`
        );
      }

      throw error;
    }
  }

  /**
   * Extract embedding from API response
   */
  private extractEmbedding(response: EmbeddingResponse): number[] {
    const embedding = response.data?.[0]?.embedding;

    if (!embedding || !Array.isArray(embedding)) {
      throw new Error("No embedding data received from SiliconFlow API");
    }

    if (embedding.length === 0) {
      throw new Error("Empty embedding received from SiliconFlow API");
    }

    return embedding;
  }

  /**
   * L2 normalization for optimal vector search performance
   */
  private normalizeL2(embedding: number[]): number[] {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));

    if (norm === 0) {
      logger.warn("Zero norm embedding detected, returning original");
      return [...embedding];
    }

    return embedding.map((val) => val / norm);
  }
}
