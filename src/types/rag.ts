/**
 * Modern RAG types for independent MCP server with Reranker integration
 * Optimized for performance and type safety
 */

export interface RAGQueryRequest {
  query: string;
  result_count?: number;
}

export interface RAGQueryResponse {
  success: boolean;
  query: string;
  results: RAGResult[];
  count: number;
  processing_time_ms: number;
  error?: string;
  suggestion?: string;
}

export interface RAGResult {
  url: string;
  content: string;
  relevance_score: number;
  metadata?: {
    title?: string;
    section?: string;
    last_updated?: string;
  };
}

export interface SearchResult {
  id: string;
  url: string;
  content: string;
}

export interface SearchOptions {
  resultCount?: number;
}

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
