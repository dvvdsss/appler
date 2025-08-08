/**
 * Modern Hybrid Search Engine
 * Combines vector and keyword search with intelligent result merging
 */
import { DatabaseService } from "./database-service";
import { EmbeddingService } from "./embedding-service";
import { SearchResult, SearchOptions } from "../types/rag";

export interface SearchResultWithScore extends SearchResult {
  rerank_score?: number;
}

export class SearchEngine {
  constructor(
    private database: DatabaseService,
    private embedding: EmbeddingService
  ) {}

  /**
   * Perform hybrid search (always enabled)
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResultWithScore[]> {
    const { matchCount = 5 } = options;
    return this.hybridSearch(query, matchCount);
  }

  /**
   * Pure vector search
   */
  private async vectorSearch(
    query: string,
    matchCount: number
  ): Promise<SearchResultWithScore[]> {
    const vectorStart = Date.now();
    console.log(`🎯 Vector Search Started: "${query}"`);

    // Generate query embedding
    const embeddingStart = Date.now();
    const queryEmbedding = await this.embedding.createEmbedding(query);
    console.log(
      `🧠 Query Embedding Generated (${Date.now() - embeddingStart}ms)`
    );

    // Perform vector search
    const searchStart = Date.now();
    const results = await this.database.vectorSearch(queryEmbedding, {
      matchCount,
    });
    console.log(`🔍 Database Vector Search (${Date.now() - searchStart}ms)`);

    const mappingStart = Date.now();
    const mappedResults = results.map((result) => ({
      ...result,
      similarity: result.similarity || 0,
    }));
    console.log(`🔄 Vector Results Mapped (${Date.now() - mappingStart}ms)`);
    console.log(
      `✅ Vector Search Completed: ${mappedResults.length} results (${Date.now() - vectorStart}ms)`
    );

    return mappedResults;
  }

  /**
   * Hybrid search combining vector and keyword search
   */
  private async hybridSearch(
    query: string,
    matchCount: number
  ): Promise<SearchResultWithScore[]> {
    // Parallel execution for optimal performance
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearch(query, matchCount),
      this.database.keywordSearch(query, { matchCount }),
    ]);

    // Intelligent result merging with deduplication
    const combinedResults = new Map<string, SearchResultWithScore>();

    // Add vector search results (higher priority)
    vectorResults.forEach((result) => {
      combinedResults.set(result.id, {
        ...result,
        similarity: result.similarity || 0,
      });
    });

    // Add keyword search results with boost for existing matches
    keywordResults.forEach((result) => {
      const existing = combinedResults.get(result.id);
      if (existing) {
        // Boost score for documents that match both vector and keyword
        existing.similarity = (existing.similarity || 0) + 0.15;
      } else {
        combinedResults.set(result.id, {
          ...result,
          similarity: 0.1, // Base score for keyword-only matches
        });
      }
    });

    // Sort by relevance and return top results
    return Array.from(combinedResults.values())
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, matchCount);
  }
}
