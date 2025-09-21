/**
 * SiliconFlow API Configuration
 * Centralized configuration for all SiliconFlow services
 */

export const SILICONFLOW_CONFIG = {
  // API Configuration
  BASE_URL: "https://api.siliconflow.cn/v1",
  TIMEOUT_MS: 7 * 1000, // 7 seconds
  USER_AGENT: "Apple-RAG-MCP/2.0.0",

  // Retry Configuration
  MAX_KEY_ATTEMPTS: 3,
  MAX_RETRIES_PER_KEY: 2,
  RETRY_BASE_DELAY: 1000, // 1 second
  RETRY_MAX_DELAY: 3000, // 3 seconds

  // Models
  EMBEDDING_MODEL: "Qwen/Qwen3-Embedding-4B",
  RERANKER_MODEL: "Qwen/Qwen3-Reranker-8B",
  RERANKER_INSTRUCTION: "Please rerank the documents based on the query.",
} as const;

export type SiliconFlowConfig = typeof SILICONFLOW_CONFIG;
