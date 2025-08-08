/**
 * Modern PostgreSQL Database Service with pgvector
 * Optimized for VPS deployment with high-performance connection pooling
 */
import postgres from "postgres";
import { AppConfig } from "../types/env.js";
import { SearchResult, SearchOptions } from "../types/rag.js";

import { logger } from "../logger.js";

export class DatabaseService {
  private sql: ReturnType<typeof postgres>;
  private initialized = false;

  constructor(config: AppConfig) {
    try {
      // VPS-optimized PostgreSQL configuration
      this.sql = postgres({
        host: config.EMBEDDING_DB_HOST,
        port: config.EMBEDDING_DB_PORT,
        database: config.EMBEDDING_DB_DATABASE,
        username: config.EMBEDDING_DB_USER,
        password: config.EMBEDDING_DB_PASSWORD,
        ssl:
          config.EMBEDDING_DB_SSLMODE === "require"
            ? {
                rejectUnauthorized: false, // Allow self-signed certificates
                checkServerIdentity: () => undefined, // Skip hostname verification
              }
            : false,

        // Local Database Performance Optimizations
        max: 20, // Increased connection pool for VPS
        idle_timeout: 300000, // 5 minutes idle timeout
        connect_timeout: 5000, // 5 seconds connect timeout (optimized for localhost)
        prepare: true, // Enable prepared statements

        // Connection retry configuration
        connection: {
          application_name: "apple-rag-mcp",
        },

        // Transform configuration
        transform: {
          undefined: null,
        },

        // Debug logging in development
        debug:
          config.NODE_ENV === "development"
            ? (_connection: number, query: string, _parameters: any[]) => {
                logger.debug("Database Query", { query: query.slice(0, 100) });
              }
            : false,
      });

      logger.info("Database service initialized", {
        host: config.EMBEDDING_DB_HOST,
        port: config.EMBEDDING_DB_PORT,
        database: config.EMBEDDING_DB_DATABASE,
        user: config.EMBEDDING_DB_USER,
        ssl: config.EMBEDDING_DB_SSLMODE,
        maxConnections: 20,
        connectTimeout: 30000,
      });
    } catch (error) {
      logger.error("Failed to create database connection:", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Database connection failed: ${error}`);
    }
  }

  /**
   * Test database connection
   */
  private async testConnection(retries = 3): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(
          `🔌 Testing Database Connection (Attempt ${attempt}/${retries})...`
        );
        const testStart = Date.now();

        // Simple connection test
        await this.sql`SELECT 1 as test`;

        console.log(
          `✅ Database Connection Test Successful (${Date.now() - testStart}ms)`
        );
        return;
      } catch (error) {
        console.log(
          `❌ Database Connection Test Failed (Attempt ${attempt}/${retries}): ${error}`
        );

        if (attempt === retries) {
          throw new Error(
            `Database connection failed after ${retries} attempts: ${error}`
          );
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Initialize database and ensure pgvector extension
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log(`📊 Database Already Initialized`);
      return;
    }

    const initStart = Date.now();
    console.log(`🗄️ Database Initialization Started...`);

    try {
      // Test connection first
      await this.testConnection();

      // Enable pgvector extension
      const extensionStart = Date.now();
      await this.sql`CREATE EXTENSION IF NOT EXISTS vector`;
      console.log(
        `🔧 pgvector Extension Enabled (${Date.now() - extensionStart}ms)`
      );

      // Verify chunks table exists
      const tableCheckStart = Date.now();
      const tableExists = await this.sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'chunks'
        )
      `;
      console.log(
        `📋 Table Existence Check (${Date.now() - tableCheckStart}ms)`
      );

      if (!tableExists[0]?.exists) {
        throw new Error(
          "Chunks table not found. Please ensure the database is properly set up."
        );
      }

      this.initialized = true;
      console.log(
        `✅ Database Initialized Successfully (${Date.now() - initStart}ms)`
      );
    } catch (error) {
      console.log(
        `❌ Database Initialization Failed: ${error} (${Date.now() - initStart}ms)`
      );
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  /**
   * Perform vector similarity search
   */
  async vectorSearch(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { matchCount = 5 } = options;
    const searchStart = Date.now();
    console.log(
      `🔍 Vector Search Started: ${queryEmbedding.length}D embedding, ${matchCount} results`
    );

    try {
      const queryStart = Date.now();
      const results = await this.sql`
        SELECT
          id,
          url,
          content,
          1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::halfvec) as similarity
        FROM chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::halfvec
        LIMIT ${matchCount}
      `;
      console.log(
        `📊 Vector Query Executed: ${results.length} results (${Date.now() - queryStart}ms)`
      );

      const mappingStart = Date.now();
      const mappedResults = results.map((row) => ({
        id: row.id as string,
        url: row.url as string,
        content: row.content as string,
        similarity: row.similarity as number,
      }));
      console.log(`🔄 Results Mapped (${Date.now() - mappingStart}ms)`);
      console.log(`✅ Vector Search Completed (${Date.now() - searchStart}ms)`);

      return mappedResults;
    } catch (error) {
      console.log(
        `❌ Vector Search Failed: ${error} (${Date.now() - searchStart}ms)`
      );
      throw new Error(`Vector search failed: ${error}`);
    }
  }

  /**
   * Perform keyword search
   */
  async keywordSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { matchCount = 5 } = options;

    try {
      const results = await this.sql`
        SELECT id, url, content
        FROM chunks
        WHERE content ILIKE ${"%" + query + "%"}
        ORDER BY id
        LIMIT ${matchCount}
      `;

      return results.map((row) => ({
        id: row.id as string,
        url: row.url as string,
        content: row.content as string,
        similarity: 0.1, // Base score for keyword matches
      }));
    } catch (error) {
      throw new Error(`Keyword search failed: ${error}`);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      await this.sql.end();
    } catch (error) {
      console.warn("Database close warning:", error);
    }
  }
}
