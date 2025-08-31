/**
 * RAG Service for Apple Developer Documentation Retrieval
 *
 * Implements Retrieval-Augmented Generation using vector embeddings for semantic search,
 * intelligent result processing, and professional AI reranking for optimal accuracy.
 *
 * Core Components:
 * - Vector embedding generation for semantic understanding
 * - High-performance similarity search with pgvector
 * - Context-aware result merging and processing
 * - Professional AI reranking with Qwen3-Reranker-8B
 * - Comprehensive error handling and performance logging
 */

import { logger } from "../logger.js";
import type { AppConfig } from "../types/env.js";
import type {
  RAGQueryRequest,
  RAGQueryResponse,
  RAGResult,
} from "../types/rag.js";
import { DatabaseService } from "./database-service.js";
import { EmbeddingService } from "./embedding-service.js";
import { RerankerService } from "./reranker-service.js";
import { type RankedSearchResult, SearchEngine } from "./search-engine.js";

export class RAGService {
  private readonly database: DatabaseService;
  private readonly embedding: EmbeddingService;
  private readonly reranker: RerankerService;
  private readonly searchEngine: SearchEngine;
  private initPromise: Promise<void> | null = null;

  constructor(config: AppConfig) {
    // Initialize all services immediately
    this.database = new DatabaseService(config);
    this.embedding = new EmbeddingService(config);
    this.reranker = new RerankerService(config);
    this.searchEngine = new SearchEngine(
      this.database,
      this.embedding,
      this.reranker
    );
  }

  /**
   * Get database service instance
   */
  getDatabase(): DatabaseService {
    return this.database;
  }

  /**
   * Initialize database connection (only async operation needed)
   */
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  private async performInitialization(): Promise<void> {
    const initStart = Date.now();
    logger.info("Initializing RAG service...");

    try {
      // Only database needs async initialization
      await this.database.initialize();

      logger.info("RAG service initialized successfully", {
        initializationTime: Date.now() - initStart,
      });
    } catch (error) {
      logger.error("RAG service initialization failed:", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`RAG service initialization failed: ${error}`);
    }
  }

  /**
   * Perform RAG query with intelligent processing and detailed timing
   */
  async query(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    const startTime = Date.now();
    const { query, result_count = 5 } = request;

    console.log(
      `🚀 RAG Query Started: "${query}" at ${new Date().toISOString()}`
    );
    console.log(`⏱️ Start Time: ${startTime}ms`);

    // Input validation
    const validationStart = Date.now();
    if (!query?.trim()) {
      console.log(
        `❌ Validation Failed: Empty query (${Date.now() - validationStart}ms)`
      );
      return this.createErrorResponse(
        query,
        "Query cannot be empty. Please provide a search query to find relevant Apple Developer Documentation.",
        "Try searching for topics like 'SwiftUI navigation', 'iOS app development', or 'API documentation'.",
        startTime
      );
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length > 10000) {
      console.log(
        `❌ Validation Failed: Query too long (${Date.now() - validationStart}ms)`
      );
      return this.createErrorResponse(
        query,
        "Query is too long. Please limit your query to 10000 characters or less.",
        "Try to make your query more concise and specific.",
        startTime
      );
    }
    console.log(`✅ Validation Passed (${Date.now() - validationStart}ms)`);

    try {
      // Initialize services (if not already initialized)
      const initStart = Date.now();
      await this.initialize();
      const initTime = Date.now() - initStart;

      logger.info("Services initialization", {
        initTime,
        alreadyInitialized: initTime === 0,
      });

      // Execute Hybrid Search with Semantic Search for RAG, Keyword Search, and AI reranking
      const resultCount = Math.min(Math.max(result_count, 1), 20);
      logger.info("Hybrid search configuration", {
        searchType: "semantic_keyword_hybrid",
        resultCount,
      });

      // Execute search
      const searchStart = Date.now();
      logger.info("Starting Hybrid search", { query: trimmedQuery });

      const searchResult = await this.searchEngine.search(trimmedQuery, {
        resultCount,
      });

      const searchTime = Date.now() - searchStart;
      logger.info("Hybrid search completed", {
        resultCount: searchResult.results.length,
        additionalUrls: searchResult.additionalUrls.length,
        searchTime,
      });

      // Format results
      const formatStart = Date.now();
      const formattedResults = this.formatResults(searchResult.results);
      const formatTime = Date.now() - formatStart;

      const totalTime = Date.now() - startTime;
      logger.info("RAG query completed", {
        totalTime,
        formatTime,
        finalResultCount: formattedResults.length,
      });

      return {
        success: true,
        query: trimmedQuery,
        results: formattedResults,
        additionalUrls: searchResult.additionalUrls,
        count: formattedResults.length,
        processing_time_ms: totalTime,
      };
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.log(
        `❌ RAG Query Failed: ${error instanceof Error ? error.message : "Unknown error"} (${errorTime}ms)`
      );
      return this.createErrorResponse(
        trimmedQuery,
        `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "Please try again with a different query or check your connection.",
        startTime
      );
    }
  }

  /**
   * Format search results for MCP response
   */
  private formatResults(results: readonly RankedSearchResult[]): RAGResult[] {
    return results.map((result) => ({
      url: result.url,
      content: result.content,
      title: result.title,
    }));
  }

  /**
   * Create standardized error response
   */
  private createErrorResponse(
    query: string,
    error: string,
    suggestion: string,
    startTime: number
  ): RAGQueryResponse {
    return {
      success: false,
      query,
      results: [],
      additionalUrls: [],
      count: 0,
      processing_time_ms: Date.now() - startTime,
      error,
      suggestion,
    };
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    if (this.database) {
      await this.database.close();
    }
  }
}
