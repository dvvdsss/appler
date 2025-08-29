/**
 * RAG Type Definitions for Apple Developer Documentation
 *
 * Type-safe interfaces for Retrieval-Augmented Generation with vector similarity search,
 * semantic understanding, and AI reranking capabilities.
 *
 * Core Types:
 * - RAG query and response interfaces
 * - Vector search result structures
 * - Semantic ranking and scoring types
 * - Embedding and configuration interfaces
 */

export interface RAGQueryRequest {
  readonly query: string;
  readonly result_count?: number;
}

export interface AdditionalUrl {
  readonly url: string;
  readonly contentLength: number;
}

export interface RAGQueryResponse {
  readonly success: boolean;
  readonly query: string;
  readonly results: readonly RAGResult[];
  readonly additionalUrls: readonly AdditionalUrl[];
  readonly count: number;
  readonly processing_time_ms: number;
  readonly error?: string;
  readonly suggestion?: string;
}

export interface RAGResult {
  readonly url: string;
  readonly content: string;
  readonly title: string;
}

export interface SearchResult {
  readonly id: string;
  readonly url: string;
  readonly content: string;
}

export interface ParsedChunk {
  readonly title: string;
  readonly content: string;
}

export interface ProcessedResult {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly content: string;
  readonly mergedFrom: readonly string[];
  readonly contentLength: number;
}

export interface SearchOptions {
  readonly resultCount?: number;
}

export interface EmbeddingConfig {
  readonly apiKey: string;
  readonly apiUrl: string;
  readonly model: string;
  readonly timeout: number;
}

export interface EmbeddingResponse {
  readonly data: readonly {
    readonly embedding: readonly number[];
  }[];
}
