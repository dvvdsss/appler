/**
 * Hybrid Search Engine for Apple Developer Documentation
 *
 * Advanced implementation combining Semantic Search for RAG with precise
 * Keyword Search and Hybrid Search, optimized for developer documentation retrieval.
 *
 * Pipeline: Query → [Vector (4N) + Technical Term (4N)] → Merge → Title Merge → AI Rerank → Results
 *
 * Features:
 * - 4N+4N hybrid candidate strategy
 * - Semantic vector search with pgvector HNSW
 * - Technical term search with PostgreSQL 'simple' configuration
 * - Title-based content merging
 * - AI reranking with Qwen3-Reranker-8B
 */

import type { SearchOptions, SearchResult } from "../types/index.js";

// Local types for search engine
export interface AdditionalUrl {
  readonly url: string;
  readonly title: string | null;
}

export interface ParsedChunk {
  readonly content: string;
  readonly title: string | null;
}

export interface ProcessedResult {
  readonly id: string;
  readonly url: string;
  readonly title: string | null;
  readonly content: string;
  readonly contentLength: number;
  readonly mergedFrom?: string[];
}

import type { DatabaseService } from "./database.js";
import type { EmbeddingService } from "./embedding.js";
import type { RerankerService } from "./reranker.js";

export interface RankedSearchResult {
  readonly id: string;
  readonly url: string;
  readonly title: string | null;
  readonly content: string;
  readonly original_index: number;
}

export interface SearchEngineResult {
  readonly results: readonly RankedSearchResult[];
  readonly additionalUrls: readonly AdditionalUrl[];
}

export class SearchEngine {
  constructor(
    private database: DatabaseService,
    private embedding: EmbeddingService,
    private reranker: RerankerService
  ) {}

  /**
   * Execute hybrid search optimized for Apple Developer Documentation
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchEngineResult> {
    const { resultCount = 5 } = options;
    return this.hybridSearchWithReranker(query, resultCount);
  }

  /**
   * Hybrid search with 4N+4N candidate strategy
   *
   * 1. Parallel: Vector search (4N) + Technical term search (4N)
   * 2. Merge and deduplicate by ID
   * 3. Title-based content merging
   * 4. AI reranking for optimal results
   */
  private async hybridSearchWithReranker(
    query: string,
    resultCount: number
  ): Promise<SearchEngineResult> {
    // Step 1: Parallel candidate retrieval (4N each, no minimum limit)
    const candidateCount = resultCount * 4;

    const [semanticResults, keywordResults] = await Promise.all([
      this.getSemanticCandidates(query, candidateCount),
      this.getKeywordCandidates(query, candidateCount),
    ]);

    // Step 2: Merge and deduplicate candidates
    const mergedCandidates = this.mergeCandidates(
      semanticResults,
      keywordResults
    );

    // Step 3: Process results (title-based merging)
    const processedResults = this.processResults(mergedCandidates);

    // Step 4: AI reranking (no score dependencies)
    const rankedDocuments = await this.reranker.rerank(
      query,
      processedResults.map((r) => r.content),
      Math.min(resultCount, processedResults.length)
    );

    // Step 5: Map back to final results
    const finalResults: RankedSearchResult[] = rankedDocuments.map((doc) => {
      const processed = processedResults[doc.originalIndex];
      return {
        id: processed.id,
        url: processed.url,
        title: processed.title,
        content: processed.content,
        original_index: doc.originalIndex,
      };
    });

    // Collect additional URLs
    const additionalUrls = this.collectAdditionalUrls(
      processedResults,
      finalResults
    );

    return { results: finalResults, additionalUrls };
  }

  /**
   * Retrieve semantic search candidates
   */
  private async getSemanticCandidates(
    query: string,
    resultCount: number
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const queryEmbedding = await this.embedding.createEmbedding(query);
    const results = await this.database.semanticSearch(queryEmbedding, {
      resultCount,
    });

    const duration = Date.now() - startTime;
    console.log(
      `Semantic search completed (${(duration / 1000).toFixed(1)}s): ${results.length} results`
    );

    return results;
  }

  /**
   * Retrieve keyword search candidates
   */
  private async getKeywordCandidates(
    query: string,
    resultCount: number
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const results = await this.database.keywordSearch(query, {
      resultCount,
    });

    const duration = Date.now() - startTime;
    console.log(
      `Keyword search completed (${(duration / 1000).toFixed(1)}s): ${results.length} results`
    );

    return results;
  }

  /**
   * Merge and deduplicate candidates from semantic and keyword search
   */
  private mergeCandidates(
    semanticResults: SearchResult[],
    keywordResults: SearchResult[]
  ): SearchResult[] {
    const seen = new Set<string>();

    // Prioritize semantic results, then add unique keyword results
    return [
      ...semanticResults.filter((result) => {
        if (seen.has(result.id)) return false;
        seen.add(result.id);
        return true;
      }),
      ...keywordResults.filter((result) => {
        if (seen.has(result.id)) return false;
        seen.add(result.id);
        return true;
      }),
    ];
  }

  /**
   * Collect additional URLs from processed results
   */
  private collectAdditionalUrls(
    processedResults: ProcessedResult[],
    finalResults: RankedSearchResult[]
  ): AdditionalUrl[] {
    const finalUrls = new Set(finalResults.map((r) => r.url));
    const additionalUrlsMap = new Map<string, number>();

    processedResults
      .filter((r) => !finalUrls.has(r.url))
      .forEach((r) => {
        if (!additionalUrlsMap.has(r.url)) {
          additionalUrlsMap.set(r.url, r.contentLength);
        }
      });

    return Array.from(additionalUrlsMap.entries())
      .map(([url, contentLength]) => ({ url, title: null, contentLength }))
      .slice(0, 10);
  }

  /**
   * Process RAG candidates through title-based merging
   */
  private processResults(candidates: SearchResult[]): ProcessedResult[] {
    // Step 1: Merge by title
    return this.mergeByTitle(candidates);
  }

  private parseChunk(content: string, title: string | null): ParsedChunk {
    // Since data migration is complete, content is now plain text
    // and title comes from the dedicated title field
    return {
      title: title || "",
      content: content,
    };
  }

  private mergeByTitle(results: SearchResult[]): ProcessedResult[] {
    const titleGroups = new Map<string, SearchResult[]>();

    // Group by title
    for (const result of results) {
      const { title } = this.parseChunk(result.content, result.title);
      const titleKey = title || "untitled";
      if (!titleGroups.has(titleKey)) {
        titleGroups.set(titleKey, []);
      }
      titleGroups.get(titleKey)!.push(result);
    }

    // Merge groups
    return Array.from(titleGroups.entries()).map(([title, group]) => {
      const primary = group[0];
      const contents = group.map(
        (r) => this.parseChunk(r.content, r.title).content
      );
      const mergedContent = contents.join("\n\n---\n\n");
      // 相同 title 必然来自同一个 URL
      const url = primary.url;

      return {
        id: primary.id,
        url: url,
        title,
        content: mergedContent,
        mergedFrom: group.map((r) => r.id),
        contentLength: mergedContent.length,
      };
    });
  }
}
