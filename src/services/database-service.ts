/**
 * Modern PostgreSQL Database Service with pgvector
 * Optimized for VPS deployment with high-performance connection pooling
 */
import postgres from "postgres";
import { logger } from "../logger.js";
import type { AppConfig } from "../types/env.js";
import type { SearchOptions, SearchResult } from "../types/rag.js";

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
            ? (_connection: number, query: string, _parameters: unknown[]) => {
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
        logger.info("Testing database connection", { attempt, retries });
        const testStart = Date.now();

        // Simple connection test
        await this.sql`SELECT 1 as test`;

        const testTime = Date.now() - testStart;
        logger.info("Database connection test successful", { testTime });
        return;
      } catch (error) {
        logger.warn("Database connection test failed", {
          attempt,
          retries,
          error: String(error)
        });

        if (attempt === retries) {
          throw new Error(
            `Database connection failed after ${retries} attempts: ${error}`
          );
        }

        // Wait before retry (exponential backoff)
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
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
      const initTime = Date.now() - initStart;
      logger.info("Database initialized successfully", { initTime });
    } catch (error) {
      const initTime = Date.now() - initStart;
      logger.error("Database initialization failed", { error: String(error), initTime });
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
    const { resultCount = 5 } = options;
    const searchStart = Date.now();
    logger.info("Vector search started", {
      embeddingDimensions: queryEmbedding.length,
      resultCount
    });

    try {
      const queryStart = Date.now();
      const results = await this.sql`
        SELECT
          id,
          url,
          content
        FROM chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::halfvec
        LIMIT ${resultCount}
      `;

      const queryTime = Date.now() - queryStart;
      logger.info("Vector query executed", {
        resultCount: results.length,
        queryTime
      });

      const mappingStart = Date.now();
      const mappedResults = results.map((row) => ({
        id: row.id as string,
        url: row.url as string,
        content: row.content as string,
      }));

      const mappingTime = Date.now() - mappingStart;
      const totalTime = Date.now() - searchStart;
      logger.info("Vector search completed", {
        mappingTime,
        totalTime
      });

      return mappedResults;
    } catch (error) {
      const totalTime = Date.now() - searchStart;
      logger.error("Vector search failed", {
        error: String(error),
        totalTime
      });
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
    const { resultCount = 5 } = options;

    try {
      const results = await this.sql`
        SELECT id, url, content
        FROM chunks
        WHERE content ILIKE ${`%${query}%`}
        ORDER BY id
        LIMIT ${resultCount}
      `;

      return results.map((row) => ({
        id: row.id as string,
        url: row.url as string,
        content: row.content as string,
      }));
    } catch (error) {
      throw new Error(`Keyword search failed: ${error}`);
    }
  }

  /**
   * Normalize URL for flexible matching
   */
  private normalizeUrl(url: string): string {
    // Remove trailing slash
    let normalized = url.replace(/\/$/, '');

    // Ensure https:// prefix
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }

    // Convert http:// to https://
    if (normalized.startsWith('http://')) {
      normalized = normalized.replace('http://', 'https://');
    }

    return normalized;
  }

  /**
   * Get page content by URL from pages table with flexible matching
   */
  async getPageByUrl(url: string): Promise<{ id: string; url: string; content: string; created_at: string; processed_at: string | null } | null> {
    const searchStart = Date.now();
    const normalizedUrl = this.normalizeUrl(url);
    logger.info("Page lookup started", { originalUrl: url, normalizedUrl });

    try {
      // Try exact match first
      let results = await this.sql`
        SELECT id, url, content, created_at, processed_at
        FROM pages
        WHERE url = ${normalizedUrl}
        LIMIT 1
      `;

      // If no exact match, try flexible matching
      if (results.length === 0) {
        // Try with/without trailing slash
        const alternativeUrl = normalizedUrl.endsWith('/')
          ? normalizedUrl.slice(0, -1)
          : normalizedUrl + '/';

        results = await this.sql`
          SELECT id, url, content, created_at, processed_at
          FROM pages
          WHERE url = ${alternativeUrl}
          LIMIT 1
        `;
      }

      const queryTime = Date.now() - searchStart;
      logger.info("Page lookup completed", {
        originalUrl: url,
        normalizedUrl,
        found: results.length > 0,
        actualUrl: results.length > 0 ? results[0].url : null,
        queryTime
      });

      if (results.length === 0) {
        return null;
      }

      const row = results[0];
      return {
        id: row.id as string,
        url: row.url as string,
        content: row.content as string,
        created_at: row.created_at as string,
        processed_at: row.processed_at as string | null,
      };
    } catch (error) {
      const totalTime = Date.now() - searchStart;
      logger.error("Page lookup failed", {
        error: String(error),
        originalUrl: url,
        normalizedUrl,
        totalTime
      });
      throw new Error(`Page lookup failed: ${error}`);
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      await this.sql.end();
    } catch (error) {
      logger.warn("Database close warning", { error: String(error) });
    }
  }
}
