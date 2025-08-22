/**
 * Modern Hybrid Search Engine with Reranker Integration
 * Combines vector and keyword search with professional reranking
 * Uses 8N strategy: Vector(4N) + Keyword(4N) → Reranker → Final(N)
 */

import type {
  ParsedContent,
  ProcessedResult,
  SearchOptions,
  SearchResult,
} from "../types/rag";
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
   * Hybrid search with professional reranking using 8N strategy
   * 1. Vector search: 4N candidates
   * 2. Keyword search: 4N candidates
   * 3. Deduplication: Remove duplicates
   * 4. Reranking: Select best N results
   */
  private async hybridSearchWithReranker(
    query: string,
    resultCount: number
  ): Promise<RankedSearchResult[]> {
    const hybridStart = Date.now();
    console.log(`🔍 Hybrid Search with Reranker Started: "${query}"`);

    // Step 1: Parallel candidate retrieval (8N strategy)
    // Each search method retrieves 4N candidates for better coverage
    const candidateStart = Date.now();
    const candidateCount = resultCount * 4; // 4N for each search method
    const [vectorResults, keywordResults] = await Promise.all([
      this.getVectorCandidates(query, candidateCount),
      this.getKeywordCandidates(query, candidateCount),
    ]);
    console.log(
      `📊 Candidates Retrieved: ${vectorResults.length} vector + ${keywordResults.length} keyword (8N strategy, ${Date.now() - candidateStart}ms)`
    );

    // Step 2: Three-step result processing
    const processStart = Date.now();
    const processedResults = this.processResults([
      ...vectorResults,
      ...keywordResults,
    ]);
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
        content: processed.content,
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
   * Three-step result processing: Dedup → Context Merge → Small Doc Merge
   */
  private processResults(candidates: SearchResult[]): ProcessedResult[] {
    // Step 1: Deduplication by ID
    const deduplicated = this.deduplicateById(candidates);

    // Step 2: Merge by context
    const contextMerged = this.mergeByContext(deduplicated);

    // Step 3: Merge small documents
    const finalResults = this.mergeSmallDocuments(contextMerged);

    console.log(
      `🔄 Processing: ${candidates.length} → ${deduplicated.length} → ${contextMerged.length} → ${finalResults.length}`
    );

    return finalResults;
  }

  private deduplicateById(candidates: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      if (seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    });
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

      return {
        id: primary.id,
        url: primary.url,
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

    return {
      id: primary.id,
      url: primary.url,
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
