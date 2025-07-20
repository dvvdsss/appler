/**
 * RAG Service - 核心RAG查询服务
 * 完全对齐Python版本的功能实现
 */

import { NEONClient } from "../database/client.js";
import { SiliconFlowEmbedding } from "../embedding/siliconflow.js";
import { HybridSearchEngine, SearchResultWithScore } from "../search/hybrid.js";

export interface RAGQueryOptions {
  query: string;
  matchCount: number;
}

export interface RAGQueryResult {
  success: boolean;
  query: string;
  search_mode: "vector" | "hybrid";
  reranking_applied: boolean;
  results: Array<{
    url: string;
    content: string;
    similarity: number;
    rerank_score?: number;
  }>;
  count: number;
  error?: string;
  suggestion?: string;
}

export class RAGService {
  private dbClient: NEONClient | null = null;
  private embeddingService: SiliconFlowEmbedding | null = null;
  private searchEngine: HybridSearchEngine | null = null;
  private initialized = false;

  constructor(private env: any) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 初始化数据库客户端
      const { NEONClient } = await import("../database/client.js");
      const { createNEONConfig } = await import("../database/config.js");

      const config = createNEONConfig(this.env);
      this.dbClient = new NEONClient(config);
      await this.dbClient.initialize();

      // 初始化embedding服务
      this.embeddingService = new SiliconFlowEmbedding(this.env);

      // 初始化搜索引擎
      this.searchEngine = new HybridSearchEngine(
        this.dbClient,
        this.embeddingService
      );

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize RAG service: ${error}`);
    }
  }

  async performRAGQuery(options: RAGQueryOptions): Promise<RAGQueryResult> {
    // 输入验证
    if (!options.query?.trim()) {
      return {
        success: false,
        query: options.query,
        search_mode: "vector",
        reranking_applied: false,
        results: [],
        count: 0,
        error:
          "Query cannot be empty. Please provide a search query to find relevant Apple Developer Documentation.",
        suggestion:
          "Try searching for topics like 'SwiftUI navigation', 'iOS app development', or 'Apple API documentation'.",
      };
    }

    const query = options.query.trim();

    try {
      await this.initialize();

      if (!this.searchEngine) {
        throw new Error("Search engine not initialized");
      }

      // 检查是否启用混合搜索
      const useHybridSearch = this.env.USE_HYBRID_SEARCH === "true";

      // 执行搜索
      const results = await this.searchEngine.search(query, {
        useHybridSearch,
        matchCount: options.matchCount,
      });

      // 格式化结果
      const formattedResults = this.formatResults(results);

      return {
        success: true,
        query,
        search_mode: useHybridSearch ? "hybrid" : "vector",
        reranking_applied: false, // 不使用reranking
        results: formattedResults,
        count: formattedResults.length,
      };
    } catch (error) {
      return {
        success: false,
        query,
        search_mode: "vector",
        reranking_applied: false,
        results: [],
        count: 0,
        error: String(error),
      };
    }
  }

  private formatResults(results: SearchResultWithScore[]) {
    return results.map((result) => ({
      url: result.url,
      content: result.content,
      similarity: result.similarity || 0,
      ...(result.rerank_score && { rerank_score: result.rerank_score }),
    }));
  }

  async close(): Promise<void> {
    if (this.dbClient) {
      await this.dbClient.close();
    }
  }
}
