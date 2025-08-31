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

import { logger } from "../logger.js";
import type {
  AdditionalUrl,
  ParsedChunk,
  ProcessedResult,
  SearchOptions,
  SearchResult,
} from "../types/rag";
import type { DatabaseService } from "./database-service";
import type { EmbeddingService } from "./embedding-service";
import type { RerankerService } from "./reranker-service";

export interface RankedSearchResult {
  readonly id: string;
  readonly url: string;
  readonly title: string;
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
    const searchStart = Date.now();
    logger.info("Hybrid search started", { query, resultCount });

    // Step 1: Parallel candidate retrieval (4N each, no minimum limit)
    const candidateStart = Date.now();
    const candidateCount = resultCount * 4;

    const [vectorResults, technicalResults] = await Promise.all([
      this.getVectorCandidates(query, candidateCount),
      this.getTechnicalTermCandidates(query, candidateCount),
    ]);

    const candidateTime = Date.now() - candidateStart;
    logger.info("Hybrid candidates retrieved", {
      vectorCount: vectorResults.length,
      technicalCount: technicalResults.length,
      strategy: "4N+4N hybrid",
      candidateTime,
    });

    // Step 2: Merge and deduplicate candidates
    const mergedCandidates = this.mergeCandidates(
      vectorResults,
      technicalResults
    );

    // Step 3: Process results (title-based merging)
    const processStart = Date.now();
    const processedResults = this.processResults(mergedCandidates);
    console.log(`🔄 Processing Complete: ${Date.now() - processStart}ms`);

    // Step 4: AI reranking (no score dependencies)
    const rerankerStart = Date.now();
    const rankedDocuments = await this.reranker.rerank(
      query,
      processedResults.map((r) => r.content),
      Math.min(resultCount, processedResults.length)
    );
    console.log(
      `🎯 Reranking Completed: ${rankedDocuments.length} results (${Date.now() - rerankerStart}ms)`
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

    const totalTime = Date.now() - searchStart;
    logger.info("Hybrid search completed", {
      totalTime,
      finalResults: finalResults.length,
      additionalUrls: additionalUrls.length,
    });

    return { results: finalResults, additionalUrls };
  }

  /**
   * Retrieve semantic candidates using vector similarity search
   */
  private async getVectorCandidates(
    query: string,
    resultCount: number
  ): Promise<SearchResult[]> {
    const vectorStart = Date.now();
    console.log(`🎯 Vector Candidates: "${query.substring(0, 30)}..."`);

    const queryEmbedding = await this.embedding.createEmbedding(query);
    const results = await this.database.vectorSearch(queryEmbedding, {
      resultCount,
    });

    console.log(
      `✅ Vector Candidates: ${results.length} results (${Date.now() - vectorStart}ms)`
    );

    return results;
  }

  /**
   * Retrieve technical term search candidates
   */
  private async getTechnicalTermCandidates(
    query: string,
    resultCount: number
  ): Promise<SearchResult[]> {
    const start = Date.now();
    console.log(`🔍 Technical Term Candidates: "${query.substring(0, 30)}..."`);

    const results = await this.database.technicalTermSearch(query, {
      resultCount,
    });

    console.log(
      `✅ Technical Term Candidates: ${results.length} results (${Date.now() - start}ms)`
    );

    return results;
  }

  /**
   * Merge and deduplicate candidates from vector and technical term search
   */
  private mergeCandidates(
    vectorResults: SearchResult[],
    technicalResults: SearchResult[]
  ): SearchResult[] {
    const seen = new Set<string>();

    // Prioritize vector results, then add unique technical results
    return [
      ...vectorResults.filter((result) => {
        if (seen.has(result.id)) return false;
        seen.add(result.id);
        return true;
      }),
      ...technicalResults.filter((result) => {
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
      .map(([url, contentLength]) => ({ url, contentLength }))
      .slice(0, 10);
  }

  /**
   * Process RAG candidates through title-based merging
   */
  private processResults(candidates: SearchResult[]): ProcessedResult[] {
    // Step 1: Merge by title
    const titleMerged = this.mergeByTitle(candidates);

    logger.info("Result processing", {
      candidates: candidates.length,
      final: titleMerged.length,
    });

    return titleMerged;
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
      if (!titleGroups.has(title)) {
        titleGroups.set(title, []);
      }
      titleGroups.get(title)!.push(result);
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
