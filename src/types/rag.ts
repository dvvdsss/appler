/**
 * Modern RAG types for independent MCP server
 * Optimized for performance and type safety
 */

export interface RAGQueryRequest {
  query: string;
  match_count?: number;
}

export interface RAGQueryResponse {
  success: boolean;
  query: string;
  search_mode: "vector" | "hybrid";
  results: RAGResult[];
  count: number;
  processing_time_ms: number;
  error?: string;
  suggestion?: string;
}

export interface RAGResult {
  url: string;
  content: string;
  similarity: number;
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
  similarity?: number;
}

export interface SearchOptions {
  matchCount?: number;
  useHybridSearch?: boolean;
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
