/**
 * Modern SiliconFlow Embedding Service - VPS Optimized
 * High-performance embedding generation with enhanced logging
 */

import { logger } from "../logger.js";
import type { AppConfig } from "../types/env.js";
import type { EmbeddingConfig, EmbeddingResponse } from "../types/rag.js";

export class EmbeddingService {
  private config: EmbeddingConfig;

  constructor(appConfig: AppConfig) {
    this.config = {
      apiKey: appConfig.SILICONFLOW_API_KEY,
      apiUrl: "https://api.siliconflow.cn/v1/embeddings",
      model: "Qwen/Qwen3-Embedding-4B",
      timeout: appConfig.SILICONFLOW_TIMEOUT * 1000,
    };

    if (!this.config.apiKey) {
      throw new Error("SILICONFLOW_API_KEY is required");
    }

    logger.info("Embedding service initialized", {
      model: this.config.model,
      timeout: this.config.timeout,
    });
  }

  /**
   * Generate embedding for query text
   */
  async createEmbedding(text: string): Promise<number[]> {
    const embeddingStart = Date.now();
    logger.info("Embedding generation started", {
      textPreview: text.substring(0, 50) + "...",
    });

    if (!text?.trim()) {
      throw new Error("Text cannot be empty for embedding generation");
    }

    const payload = {
      model: this.config.model,
      input: text.trim(),
      encoding_format: "float",
    };

    const headers = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Apple-RAG-MCP/2.0.0",
    };

    try {
      const requestStart = Date.now();
      logger.info("SiliconFlow API request started");

      const response = await fetch(this.config.apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      const requestTime = Date.now() - requestStart;
      logger.info("SiliconFlow API response received", { requestTime });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(
          `SiliconFlow API error ${response.status}: ${errorText}`
        );
      }

      const parseStart = Date.now();
      const result = (await response.json()) as EmbeddingResponse;
      const embedding = result.data?.[0]?.embedding;

      if (!embedding) {
        throw new Error("No embedding data received from SiliconFlow API");
      }

      const parseTime = Date.now() - parseStart;
      logger.info("API response parsed", {
        vectorDimensions: embedding.length,
        parseTime,
      });

      // L2 normalization for optimal vector search
      const normalizeStart = Date.now();
      const normalizedEmbedding = this.normalizeL2(embedding);
      const normalizeTime = Date.now() - normalizeStart;

      const totalTime = Date.now() - embeddingStart;
      logger.info("Embedding generation completed", {
        normalizeTime,
        totalTime,
      });

      return normalizedEmbedding;
    } catch (error) {
      const totalTime = Date.now() - embeddingStart;
      logger.error("Embedding generation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        totalTime,
      });
      if (error instanceof Error) {
        throw new Error(`Embedding generation failed: ${error.message}`);
      }
      throw new Error("Embedding generation failed: Unknown error");
    }
  }

  /**
   * L2 normalization for vector embeddings
   */
  private normalizeL2(embedding: readonly number[]): number[] {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map((val) => val / norm) : [...embedding];
  }
}
