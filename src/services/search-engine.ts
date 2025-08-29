/**
 * RAG Search Engine with Vector Similarity and Semantic AI Reranking
 *
 * Implements retrieval-augmented generation using vector embeddings for semantic search
 * and professional AI reranking for optimal result quality.
 *
 * Processing Pipeline:
 * Query → Vector Embedding → Similarity Search → Title-based Merging → AI Reranking → Results
 *
 * Features:
 * - High-performance vector similarity search with pgvector
 * - Intelligent title-based merging for comprehensive results
 * - Professional AI reranking with Qwen3-Reranker-8B
 * - Optimized for Apple Developer Documentation retrieval
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
   * Execute RAG search with vector similarity and AI reranking
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchEngineResult> {
    const { resultCount = 5 } = options;
    return this.vectorSearchWithReranker(query, resultCount);
  }

  /**
   * RAG search implementation with minimum 10 chunks strategy
   *
   * 1. Generate vector embedding for semantic similarity
   * 2. Retrieve candidates using vector search (minimum 10 chunks)
   * 3. Merge related content by title
   * 4. Apply AI reranking to select best N results
   */
  private async vectorSearchWithReranker(
    query: string,
    resultCount: number
  ): Promise<SearchEngineResult> {
    const searchStart = Date.now();
    logger.info("Vector search started", { query, resultCount });

    // Step 1: Vector candidate retrieval (minimum 10 chunks)
    const candidateStart = Date.now();
    const candidateCount = Math.max(resultCount * 4, 10); // Ensure minimum 10 chunks
    const vectorResults = await this.getVectorCandidates(query, candidateCount);

    const candidateTime = Date.now() - candidateStart;
    logger.info("Vector candidates retrieved", {
      vectorCount: vectorResults.length,
      strategy: "4N with minimum 10 chunks",
      candidateTime,
    });

    // Step 2: Result processing
    const processStart = Date.now();
    const processedResults = this.processResults(vectorResults);
    console.log(`🔄 Processing Complete: ${Date.now() - processStart}ms`);

    // Step 3: Professional reranking
    const rerankerStart = Date.now();
    const rankedDocuments = await this.reranker.rerank(
      query,
      processedResults.map((r) => r.content),
      Math.min(resultCount, processedResults.length)
    );
    console.log(
      `🎯 Reranking Completed: ${rankedDocuments.length} results (${Date.now() - rerankerStart}ms)`
    );

    // Step 4: Map back to search results
    const mappingStart = Date.now();
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
    console.log(`🔄 Results Mapped (${Date.now() - mappingStart}ms)`);

    // Collect additional URLs from candidates not in final results
    const finalUrls = new Set(finalResults.map((r) => r.url));
    const additionalUrlsMap = new Map<string, number>();

    // Collect unique URLs with their content lengths
    processedResults
      .filter((r) => !finalUrls.has(r.url))
      .forEach((r) => {
        if (!additionalUrlsMap.has(r.url)) {
          additionalUrlsMap.set(r.url, r.contentLength);
        }
      });

    const additionalUrls = Array.from(additionalUrlsMap.entries())
      .map(([url, contentLength]) => ({ url, contentLength }))
      .slice(0, 10); // Limit to 10 additional URLs

    const totalTime = Date.now() - searchStart;
    logger.info("Vector search completed", {
      finalResults: finalResults.length,
      additionalUrls: additionalUrls.length,
      totalTime,
    });

    return {
      results: finalResults,
      additionalUrls,
    };
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

  private parseChunk(content: string): ParsedChunk {
    try {
      const parsed = JSON.parse(content);
      return {
        title: parsed.title || "",
        content: parsed.content || content,
      };
    } catch {
      return { title: "", content };
    }
  }

  private mergeByTitle(results: SearchResult[]): ProcessedResult[] {
    const titleGroups = new Map<string, SearchResult[]>();

    // Group by title
    for (const result of results) {
      const { title } = this.parseChunk(result.content);
      if (!titleGroups.has(title)) {
        titleGroups.set(title, []);
      }
      titleGroups.get(title)!.push(result);
    }

    // Merge groups
    return Array.from(titleGroups.entries()).map(([title, group]) => {
      const primary = group[0];
      const contents = group.map((r) => this.parseChunk(r.content).content);
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
