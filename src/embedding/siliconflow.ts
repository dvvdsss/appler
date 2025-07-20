/**
 * SiliconFlow API Embedding Service
 * 专用于MCP RAG查询的embedding生成服务
 */

export interface EmbeddingConfig {
  apiKey: string;
  apiUrl: string;
  model: string;
  timeout: number;
}

export interface EmbeddingResponse {
  data: Array<{
    embedding: number[];
  }>;
}

export class SiliconFlowEmbedding {
  private config: EmbeddingConfig;

  constructor(env: any) {
    this.config = {
      apiKey: env.SILICONFLOW_API_KEY,
      apiUrl: 'https://api.siliconflow.cn/v1/embeddings',
      model: 'Qwen/Qwen3-Embedding-4B',
      timeout: parseInt(env.SILICONFLOW_TIMEOUT || '30') * 1000,
    };

    if (!this.config.apiKey) {
      throw new Error('SILICONFLOW_API_KEY is required');
    }
  }

  async createQueryEmbedding(query: string): Promise<number[]> {
    if (!query?.trim()) {
      throw new Error('Query cannot be empty for embedding generation');
    }

    const payload = {
      model: this.config.model,
      input: query.trim(),
      encoding_format: 'float',
    };

    const headers = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.config.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SiliconFlow API error ${response.status}: ${errorText}`);
      }

      const result: EmbeddingResponse = await response.json();
      const embedding = result.data[0].embedding;

      // L2标准化
      return this.normalizeL2(embedding);
    } catch (error) {
      throw new Error(`Failed to create embedding: ${error}`);
    }
  }

  private normalizeL2(embedding: number[]): number[] {
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return norm > 0 ? embedding.map(val => val / norm) : embedding;
  }
}
