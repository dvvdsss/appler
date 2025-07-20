/**
 * 混合搜索引擎 - 向量相似度 + 关键词搜索
 * 优雅现代的搜索策略实现
 */

import { NEONClient, SearchResult } from '../database/client.js';
import { SiliconFlowEmbedding } from '../embedding/siliconflow.js';

export interface HybridSearchOptions {
  useHybridSearch: boolean;
  matchCount: number;
}

export interface SearchResultWithScore extends SearchResult {
  rerank_score?: number;
}

export class HybridSearchEngine {
  constructor(
    private dbClient: NEONClient,
    private embeddingService: SiliconFlowEmbedding
  ) {}

  async search(
    query: string,
    options: HybridSearchOptions
  ): Promise<SearchResultWithScore[]> {
    if (options.useHybridSearch) {
      return this.performHybridSearch(query, options.matchCount);
    } else {
      return this.performVectorSearch(query, options.matchCount);
    }
  }

  private async performVectorSearch(
    query: string,
    matchCount: number
  ): Promise<SearchResultWithScore[]> {
    const queryEmbedding = await this.embeddingService.createQueryEmbedding(query);
    return this.dbClient.searchDocumentsVector(queryEmbedding, matchCount);
  }

  private async performHybridSearch(
    query: string,
    matchCount: number
  ): Promise<SearchResultWithScore[]> {
    // 并行执行向量搜索和关键词搜索
    const [vectorResults, keywordResults] = await Promise.all([
      this.performVectorSearch(query, matchCount * 2),
      this.dbClient.searchDocumentsKeyword(query, matchCount * 2),
    ]);

    // 合并结果，优先考虑同时出现在两种搜索中的结果
    return this.mergeSearchResults(vectorResults, keywordResults, matchCount);
  }

  private mergeSearchResults(
    vectorResults: SearchResult[],
    keywordResults: SearchResult[],
    matchCount: number
  ): SearchResultWithScore[] {
    const seenIds = new Set<string>();
    const combinedResults: SearchResultWithScore[] = [];

    // 1. 添加同时出现在两种搜索中的结果（最高优先级）
    const vectorIds = new Set(vectorResults.map(r => r.id));
    
    for (const keywordResult of keywordResults) {
      if (vectorIds.has(keywordResult.id) && !seenIds.has(keywordResult.id)) {
        const vectorResult = vectorResults.find(r => r.id === keywordResult.id);
        if (vectorResult) {
          // 提升相似度分数
          const boostedSimilarity = Math.min(1.0, (vectorResult.similarity || 0) * 1.2);
          combinedResults.push({
            ...vectorResult,
            similarity: boostedSimilarity,
          });
          seenIds.add(keywordResult.id);
        }
      }
    }

    // 2. 添加剩余的向量搜索结果
    for (const vectorResult of vectorResults) {
      if (!seenIds.has(vectorResult.id) && combinedResults.length < matchCount) {
        combinedResults.push(vectorResult);
        seenIds.add(vectorResult.id);
      }
    }

    // 3. 添加纯关键词匹配结果
    for (const keywordResult of keywordResults) {
      if (!seenIds.has(keywordResult.id) && combinedResults.length < matchCount) {
        combinedResults.push({
          ...keywordResult,
          similarity: 0.5, // 默认相似度
        });
        seenIds.add(keywordResult.id);
      }
    }

    return combinedResults.slice(0, matchCount);
  }
}
