/**
 * Modern RAG Service - VPS Optimized Implementation
 * High-performance RAG with intelligent error handling and logging
 */
import { AppConfig } from "../types/env.js";
import { RAGQueryRequest, RAGQueryResponse, RAGResult } from "../types/rag.js";
import { DatabaseService } from "./database-service.js";
import { EmbeddingService } from "./embedding-service.js";
import { SearchEngine, SearchResultWithScore } from "./search-engine.js";
import { logger } from "../logger.js";

export class RAGService {
  private database: DatabaseService | null = null;
  private embedding: EmbeddingService | null = null;
  private searchEngine: SearchEngine | null = null;
  private initialized = false;

  constructor(private config: AppConfig) {}

  /**
   * Initialize all services with VPS optimizations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const initStart = Date.now();
    logger.info('Initializing RAG service...');

    try {
      // Initialize services in optimal order
      this.database = new DatabaseService(this.config);
      await this.database.initialize();

      this.embedding = new EmbeddingService(this.config);
      this.searchEngine = new SearchEngine(this.database, this.embedding);

      this.initialized = true;

      logger.info('RAG service initialized successfully', {
        initializationTime: Date.now() - initStart
      });
    } catch (error) {
      logger.error('RAG service initialization failed:', { error: error instanceof Error ? error.message : String(error) });
      throw new Error(`RAG service initialization failed: ${error}`);
    }
  }

  /**
   * Perform RAG query with intelligent processing and detailed timing
   */
  async query(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    const startTime = Date.now();
    const { query, match_count = 5 } = request;

    console.log(`🚀 RAG Query Started: "${query}" at ${new Date().toISOString()}`);
    console.log(`⏱️ Start Time: ${startTime}ms`);

    // Input validation
    const validationStart = Date.now();
    if (!query?.trim()) {
      console.log(`❌ Validation Failed: Empty query (${Date.now() - validationStart}ms)`);
      return this.createErrorResponse(
        query,
        "Query cannot be empty. Please provide a search query to find relevant Apple Developer Documentation.",
        "Try searching for topics like 'SwiftUI navigation', 'iOS app development', or 'Apple API documentation'.",
        startTime
      );
    }

    const trimmedQuery = query.trim();
    if (trimmedQuery.length > 1000) {
      console.log(`❌ Validation Failed: Query too long (${Date.now() - validationStart}ms)`);
      return this.createErrorResponse(
        query,
        "Query is too long. Please limit your query to 1000 characters or less.",
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
      if (initTime > 0) {
        console.log(`🔧 Services Initialized (${initTime}ms)`);
      } else {
        console.log(`🔧 Services Already Initialized (0ms)`);
      }

      if (!this.searchEngine) {
        throw new Error("Search engine not initialized");
      }

      // Execute hybrid search (always enabled)
      const configStart = Date.now();
      const matchCount = Math.min(Math.max(match_count, 1), 20);
      console.log(`⚙️ Configuration Set: hybrid search, ${matchCount} results (${Date.now() - configStart}ms)`);

      // Execute search
      const searchStart = Date.now();
      console.log(`🔍 Starting Hybrid Search Operation...`);
      const results = await this.searchEngine.search(trimmedQuery, {
        matchCount,
      });
      console.log(`🔍 Hybrid Search Completed: ${results.length} results (${Date.now() - searchStart}ms)`);

      // Format results
      const formatStart = Date.now();
      const formattedResults = this.formatResults(results);
      console.log(`📝 Results Formatted (${Date.now() - formatStart}ms)`);

      const totalTime = Date.now() - startTime;
      console.log(`🎉 RAG Query Completed Successfully: Total ${totalTime}ms`);

      return {
        success: true,
        query: trimmedQuery,
        results: formattedResults,
        count: formattedResults.length,
        processing_time_ms: totalTime,
      };
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.log(`❌ RAG Query Failed: ${error instanceof Error ? error.message : "Unknown error"} (${errorTime}ms)`);
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
  private formatResults(results: SearchResultWithScore[]): RAGResult[] {
    return results.map((result) => ({
      url: result.url,
      content: result.content,
      similarity: result.similarity || 0,
      metadata: {
        // Extract metadata from URL if available
        title: this.extractTitleFromUrl(result.url),
        section: this.extractSectionFromUrl(result.url),
      },
    }));
  }

  /**
   * Extract title from Apple documentation URL
   */
  private extractTitleFromUrl(url: string): string | undefined {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      return pathParts[pathParts.length - 1]?.replace(/-/g, ' ') || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Extract section from Apple documentation URL
   */
  private extractSectionFromUrl(url: string): string | undefined {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      return pathParts[pathParts.length - 2]?.replace(/-/g, ' ') || undefined;
    } catch {
      return undefined;
    }
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
