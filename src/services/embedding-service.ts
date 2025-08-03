/**
 * Modern SiliconFlow Embedding Service - VPS Optimized
 * High-performance embedding generation with enhanced logging
 */
import { AppConfig } from "../types/env.js";
import { EmbeddingConfig, EmbeddingResponse } from "../types/rag.js";
import { logger } from "../logger.js";

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

    logger.info('Embedding service initialized', {
      model: this.config.model,
      timeout: this.config.timeout
    });
  }

  /**
   * Generate embedding for query text
   */
  async createEmbedding(text: string): Promise<number[]> {
    const embeddingStart = Date.now();
    console.log(`🧠 Embedding Generation Started: "${text.substring(0, 50)}..."`);

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
      console.log(`📡 SiliconFlow API Request Started...`);
      const response = await fetch(this.config.apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout),
      });
      console.log(`📡 SiliconFlow API Response Received (${Date.now() - requestStart}ms)`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(
          `SiliconFlow API error ${response.status}: ${errorText}`
        );
      }

      const parseStart = Date.now();
      const result = await response.json() as EmbeddingResponse;
      const embedding = result.data?.[0]?.embedding;

      if (!embedding) {
        throw new Error('No embedding data received from SiliconFlow API');
      }

      console.log(`📊 API Response Parsed: ${embedding.length}D vector (${Date.now() - parseStart}ms)`);

      // L2 normalization for optimal vector search
      const normalizeStart = Date.now();
      const normalizedEmbedding = this.normalizeL2(embedding);
      console.log(`🔧 L2 Normalization Completed (${Date.now() - normalizeStart}ms)`);
      console.log(`✅ Embedding Generation Completed (${Date.now() - embeddingStart}ms)`);

      return normalizedEmbedding;
    } catch (error) {
      console.log(`❌ Embedding Generation Failed: ${error instanceof Error ? error.message : "Unknown error"} (${Date.now() - embeddingStart}ms)`);
      if (error instanceof Error) {
        throw new Error(`Embedding generation failed: ${error.message}`);
      }
      throw new Error("Embedding generation failed: Unknown error");
    }
  }

  /**
   * L2 normalization for vector embeddings
   */
  private normalizeL2(embedding: number[]): number[] {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map((val) => val / norm) : embedding;
  }
}
