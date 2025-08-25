/**
 * RAG Search Engine with Vector Similarity and Semantic AI Reranking
 *
 * Implements retrieval-augmented generation using vector embeddings for semantic search
 * and professional AI reranking for optimal result quality.
 *
 * Processing Pipeline:
 * Query → Vector Embedding → Similarity Search → Context Merging → Document Merging → AI Reranking → Results
 *
 * Features:
 * - High-performance vector similarity search with pgvector
 * - Intelligent context and document merging for comprehensive results
 * - Professional AI reranking with Qwen3-Reranker-8B
 * - Optimized for Apple Developer Documentation retrieval
 */

import { logger } from "../logger.js";
import type {
  ParsedContent,
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
  readonly context: string;
  readonly content: string;
  readonly relevance_score: number;
  readonly original_index: number;
}

export interface SearchEngineResult {
  readonly results: readonly RankedSearchResult[];
  readonly additionalUrls: readonly string[];
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
   * RAG search implementation with 4N candidate strategy
   *
   * 1. Generate vector embedding for semantic similarity
   * 2. Retrieve 4N candidates using vector search
   * 3. Merge related content by context
   * 4. Combine small documents for comprehensive results
   * 5. Apply AI reranking to select best N results
   */
  private async vectorSearchWithReranker(
    query: string,
    resultCount: number
  ): Promise<SearchEngineResult> {
    const searchStart = Date.now();
    logger.info("Vector search started", { query, resultCount });

    // Step 1: Vector candidate retrieval (4N strategy)
    const candidateStart = Date.now();
    const candidateCount = resultCount * 4; // 4N for better coverage
    const vectorResults = await this.getVectorCandidates(query, candidateCount);

    const candidateTime = Date.now() - candidateStart;
    logger.info("Vector candidates retrieved", {
      vectorCount: vectorResults.length,
      strategy: "4N",
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
        context: processed.context,
        content: processed.content,
        relevance_score: doc.relevanceScore,
        original_index: doc.originalIndex,
      };
    });
    console.log(`🔄 Results Mapped (${Date.now() - mappingStart}ms)`);

    // Collect additional URLs from candidates not in final results
    const finalUrls = new Set(finalResults.map((r) => r.url));
    const additionalUrls = processedResults
      .filter((r) => !finalUrls.has(r.url))
      .map((r) => r.url)
      .filter((url, index, arr) => arr.indexOf(url) === index) // Remove duplicates
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
   * Process RAG candidates through context and document merging
   */
  private processResults(candidates: SearchResult[]): ProcessedResult[] {
    // Step 1: Merge by context
    const contextMerged = this.mergeByContext(candidates);

    // Step 2: Merge small documents
    const finalResults = this.mergeSmallDocuments(contextMerged);

    logger.info("Result processing", {
      candidates: candidates.length,
      contextMerged: contextMerged.length,
      final: finalResults.length,
    });

    return finalResults;
  }

  private parseContent(content: string): ParsedContent {
    try {
      const parsed = JSON.parse(content);
      return {
        context: parsed.context || "",
        content: parsed.content || content,
      };
    } catch {
      return { context: "", content };
    }
  }

  private mergeByContext(results: SearchResult[]): ProcessedResult[] {
    const contextGroups = new Map<string, SearchResult[]>();

    // Group by context
    for (const result of results) {
      const { context } = this.parseContent(result.content);
      if (!contextGroups.has(context)) {
        contextGroups.set(context, []);
      }
      contextGroups.get(context)!.push(result);
    }

    // Merge groups
    return Array.from(contextGroups.entries()).map(([context, group]) => {
      const primary = group[0];
      const contents = group.map((r) => this.parseContent(r.content).content);
      const mergedContent = contents.join("\n\n---\n\n");
      // 相同 context 必然来自同一个 URL
      const url = primary.url;

      return {
        id: primary.id,
        url: url, // 单个 URL
        context,
        content: mergedContent,
        mergedFrom: group.map((r) => r.id),
        contentLength: mergedContent.length,
      };
    });
  }

  private mergeSmallDocuments(results: ProcessedResult[]): ProcessedResult[] {
    const large = results.filter((r) => r.contentLength >= 1500);
    const small = results.filter((r) => r.contentLength < 1500);

    if (small.length === 0) return large;

    // 关键：按字符数由小到大排序，先合并小的再合并大的
    const sortedSmall = small.sort((a, b) => a.contentLength - b.contentLength);

    const merged: ProcessedResult[] = [];
    let currentBatch: ProcessedResult[] = [];
    let currentLength = 0;

    for (const doc of sortedSmall) {
      if (currentLength + doc.contentLength <= 1500) {
        currentBatch.push(doc);
        currentLength += doc.contentLength;
      } else {
        if (currentBatch.length > 0) {
          merged.push(this.createMergedDocument(currentBatch));
        }
        currentBatch = [doc];
        currentLength = doc.contentLength;
      }
    }

    if (currentBatch.length > 0) {
      merged.push(this.createMergedDocument(currentBatch));
    }

    return [...large, ...merged];
  }

  private createMergedDocument(docs: ProcessedResult[]): ProcessedResult {
    const primary = docs[0];
    const allContent = docs.map((d) => d.content).join("\n\n---\n\n");
    const allIds = docs.flatMap((d) => d.mergedFrom);
    // 大小合并时使用主文档的 URL
    const url = primary.url;

    return {
      id: primary.id,
      url: url, // 单个 URL
      context: `Merged: ${docs
        .map((d) => d.context)
        .filter(Boolean)
        .join(" | ")}`,
      content: allContent,
      mergedFrom: allIds,
      contentLength: allContent.length,
    };
  }
}
