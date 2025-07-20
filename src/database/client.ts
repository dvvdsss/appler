/**
 * NEON Database Client - 现代异步PostgreSQL客户端
 * 专为Cloudflare Workers环境优化
 */

import postgres from 'postgres';
import { NEONConfig, getConnectionString } from './config.js';

export interface SearchResult {
  id: string;
  url: string;
  content: string;
  similarity?: number;
}

export class NEONClient {
  private sql: ReturnType<typeof postgres>;
  private initialized = false;

  constructor(private config: NEONConfig) {
    this.sql = postgres(getConnectionString(config), {
      max: config.max_connections,
      idle_timeout: config.connection_timeout,
      ssl: config.ssl ? 'require' : false,
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 启用pgvector扩展
      await this.sql`CREATE EXTENSION IF NOT EXISTS vector`;

      // 创建chunks表
      await this.sql`
        CREATE TABLE IF NOT EXISTS chunks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          url TEXT NOT NULL,
          content TEXT NOT NULL,
          embedding vector(2560),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `;

      // 创建索引
      await this.sql`CREATE INDEX IF NOT EXISTS idx_chunks_url ON chunks(url)`;
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  async searchDocumentsVector(queryEmbedding: number[], matchCount: number = 10): Promise<SearchResult[]> {
    const results = await this.sql`
      SELECT id, url, content,
             1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM chunks
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${matchCount}
    `;

    return results.map(row => ({
      id: row.id as string,
      url: row.url as string,
      content: row.content as string,
      similarity: row.similarity as number,
    }));
  }

  async searchDocumentsKeyword(query: string, matchCount: number = 10): Promise<SearchResult[]> {
    const results = await this.sql`
      SELECT id, url, content
      FROM chunks
      WHERE content ILIKE ${'%' + query + '%'}
      ORDER BY created_at DESC
      LIMIT ${matchCount}
    `;

    return results.map(row => ({
      id: row.id as string,
      url: row.url as string,
      content: row.content as string,
    }));
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}
