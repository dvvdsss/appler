/**
 * Modern Hybrid Search Engine with Reranker Integration
 * Combines vector and keyword search with professional reranking
 * Uses 4N strategy: Vector(2N) + Keyword(2N) → Reranker → Final(N)
 */

import type { SearchOptions, SearchResult } from "../types/rag";
import type { DatabaseService } from "./database-service";
import type { EmbeddingService } from "./embedding-service";
import type { RerankerService } from "./reranker-service";

export interface RankedSearchResult extends SearchResult {
  relevance_score: number;
  original_index: number;
}

export class SearchEngine {
  constructor(
    private database: DatabaseService,
    private embedding: EmbeddingService,
    private reranker: RerankerService
  ) {}

  /**
   * Perform hybrid search with professional reranking
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<RankedSearchResult[]> {
    const { resultCount = 5 } = options;
    return this.hybridSearchWithReranker(query, resultCount);
  }

  /**
   * Hybrid search with professional reranking using 4N strategy
   * 1. Vector search: 2N candidates
   * 2. Keyword search: 2N candidates
   * 3. Deduplication: Remove duplicates
   * 4. Reranking: Select best N results
   */
  private async hybridSearchWithReranker(
    query: string,
    resultCount: number
  ): Promise<RankedSearchResult[]> {
    const hybridStart = Date.now();
    console.log(`🔍 Hybrid Search with Reranker Started: "${query}"`);

    // Step 1: Parallel candidate retrieval (4N strategy)
    // Each search method retrieves 2N candidates for better coverage
    const candidateStart = Date.now();
    const candidateCount = resultCount * 2; // 2N for each search method
    const [vectorResults, keywordResults] = await Promise.all([
      this.getVectorCandidates(query, candidateCount),
      this.getKeywordCandidates(query, candidateCount),
    ]);
    console.log(
      `📊 Candidates Retrieved: ${vectorResults.length} vector + ${keywordResults.length} keyword (4N strategy, ${Date.now() - candidateStart}ms)`
    );

    // Step 2: Simple deduplication (no complex scoring)
    const dedupeStart = Date.now();
    const candidates = this.deduplicateCandidates([
      ...vectorResults,
      ...keywordResults,
    ]);
    console.log(
      `🔄 Candidates Deduplicated: ${candidates.length} unique (${Date.now() - dedupeStart}ms)`
    );

    // Step 3: Professional reranking
    const rerankerStart = Date.now();
    const rankedDocuments = await this.reranker.rerank(
      query,
      candidates.map((c) => c.content),
      Math.min(resultCount, candidates.length)
    );
    console.log(
      `🎯 Reranking Completed: ${rankedDocuments.length} results (${Date.now() - rerankerStart}ms)`
    );

    // Step 4: Map back to search results
    const mappingStart = Date.now();
    const finalResults: RankedSearchResult[] = rankedDocuments.map((doc) => {
      const originalCandidate = candidates[doc.originalIndex];
      return {
        id: originalCandidate.id,
        url: originalCandidate.url,
        content: doc.content,
        relevance_score: doc.relevanceScore,
        original_index: doc.originalIndex,
      };
    });
    console.log(`🔄 Results Mapped (${Date.now() - mappingStart}ms)`);

    console.log(
      `✅ Hybrid Search with Reranker Completed: ${finalResults.length} results (${Date.now() - hybridStart}ms)`
    );

    return finalResults;
  }

  /**
   * Get vector search candidates
   */
  private async getVectorCandidates(
    query: string,
    resultCount: number
  ): Promise<SearchResult[]> {
    const vectorStart = Date.now();
    console.log(`🎯 Vector Candidates: "${query.substring(0, 30)}..."`);

    // Generate query embedding
    const queryEmbedding = await this.embedding.createEmbedding(query);

    // Perform vector search
    const results = await this.database.vectorSearch(queryEmbedding, {
      resultCount,
    });

    console.log(
      `✅ Vector Candidates: ${results.length} results (${Date.now() - vectorStart}ms)`
    );

    return results;
  }

  /**
   * Get keyword search candidates
   */
  private async getKeywordCandidates(
    query: string,
    resultCount: number
  ): Promise<SearchResult[]> {
    const keywordStart = Date.now();
    console.log(`🔤 Keyword Candidates: "${query.substring(0, 30)}..."`);

    const results = await this.database.keywordSearch(query, { resultCount });

    console.log(
      `✅ Keyword Candidates: ${results.length} results (${Date.now() - keywordStart}ms)`
    );

    return results;
  }

  /**
   * Simple deduplication based on document ID
   */
  private deduplicateCandidates(candidates: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduplicated: SearchResult[] = [];

    for (const candidate of candidates) {
      if (!seen.has(candidate.id)) {
        seen.add(candidate.id);
        deduplicated.push(candidate);
      }
    }

    return deduplicated;
  }
}
