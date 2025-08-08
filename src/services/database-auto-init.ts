/**
 * Automatic Database Initialization
 * Ensures database tables exist when the server starts
 */
import { logger } from "../logger.js";
import type { CloudflareD1Config } from "./d1-connector.js";

interface TableSchema {
  name: string;
  sql: string;
}

const REQUIRED_TABLES: TableSchema[] = [
  {
    name: "users",
    sql: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT,
      avatar TEXT,
      provider TEXT NOT NULL DEFAULT 'email',
      provider_id TEXT,
      tier TEXT NOT NULL DEFAULT 'free',
      oauth_provider TEXT,
      oauth_id TEXT,
      stripe_customer_id TEXT,
      reset_token TEXT,
      reset_token_expires_at TEXT,
      last_login TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    )`,
  },
  {
    name: "mcp_tokens",
    sql: `CREATE TABLE IF NOT EXISTS mcp_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mcp_token TEXT NOT NULL,
      last_used_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  },
  {
    name: "usage_logs",
    sql: `CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL,
      mcp_token TEXT,
      query_text TEXT,
      result_count INTEGER DEFAULT 0,
      response_time_ms INTEGER,
      status_code INTEGER,
      error_code TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
  },
];

const TEST_DATA = {
  user: {
    id: "auto-init-test-user",
    email: "test@apple-rag-mcp.dev",
    name: "Auto Init Test User",
    tier: "free",
  },
  token: {
    id: "auto-init-test-token",
    user_id: "auto-init-test-user",
    name: "Auto Generated Test Token",
    mcp_token: "at_0f4f7b87f0fe4818b3fd38960cff3c55",
  },
};

export class DatabaseAutoInit {
  private config: CloudflareD1Config;

  constructor(config: CloudflareD1Config) {
    this.config = config;
  }

  /**
   * Initialize database with required tables and test data
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Starting automatic database initialization...");

      // Check if tables exist
      const missingTables = await this.checkMissingTables();

      if (missingTables.length === 0) {
        logger.info("All required tables exist, skipping initialization");
        await this.ensureTestData();
        return;
      }

      logger.info("Missing tables detected, creating...", {
        tables: missingTables,
      });

      // Create missing tables
      await this.createTables(missingTables);

      // Insert test data
      await this.insertTestData();

      logger.info("Database initialization completed successfully");
    } catch (error) {
      logger.error("Database initialization failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check which required tables are missing
   */
  private async checkMissingTables(): Promise<TableSchema[]> {
    try {
      const response = await this.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );

      const existingTables = response.results.map((row: any) => row.name);
      const missingTables = REQUIRED_TABLES.filter(
        (table) => !existingTables.includes(table.name)
      );

      return missingTables;
    } catch (error) {
      // If query fails, assume all tables are missing
      logger.warn("Failed to check existing tables, assuming all are missing");
      return REQUIRED_TABLES;
    }
  }

  /**
   * Create missing tables
   */
  private async createTables(tables: TableSchema[]): Promise<void> {
    for (const table of tables) {
      try {
        await this.executeQuery(table.sql);
        logger.info(`Created table: ${table.name}`);
      } catch (error) {
        logger.error(`Failed to create table: ${table.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }
  }

  /**
   * Insert test data for development
   */
  private async insertTestData(): Promise<void> {
    try {
      // Insert test user
      await this.executeQuery(
        `INSERT OR REPLACE INTO users (id, email, name, tier, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          TEST_DATA.user.id,
          TEST_DATA.user.email,
          TEST_DATA.user.name,
          TEST_DATA.user.tier,
        ]
      );

      // Insert test MCP token
      await this.executeQuery(
        `INSERT OR REPLACE INTO mcp_tokens (id, user_id, name, mcp_token, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          TEST_DATA.token.id,
          TEST_DATA.token.user_id,
          TEST_DATA.token.name,
          TEST_DATA.token.mcp_token,
        ]
      );

      logger.info("Test data inserted successfully", {
        user: TEST_DATA.user.email,
        token: TEST_DATA.token.mcp_token.substring(0, 8) + "...",
      });
    } catch (error) {
      logger.error("Failed to insert test data", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Ensure test data exists (for existing databases)
   */
  private async ensureTestData(): Promise<void> {
    try {
      // Check if test token exists
      const tokenCheck = await this.executeQuery(
        "SELECT id FROM mcp_tokens WHERE mcp_token = ?",
        [TEST_DATA.token.mcp_token]
      );

      if (tokenCheck.results.length === 0) {
        logger.info("Test token not found, inserting test data...");
        await this.insertTestData();
      } else {
        logger.info("Test token exists, database ready");
      }
    } catch (error) {
      logger.warn("Failed to check test data, continuing...", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Execute D1 query via REST API
   */
  private async executeQuery(sql: string, params: any[] = []): Promise<any> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.config.accountId}/d1/database/${this.config.databaseId}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `D1 API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = (await response.json()) as {
      errors?: Array<{ code: number; message: string }>;
      result?: Array<{ results: any[]; success: boolean; meta?: any }>;
    };

    if (data.errors?.length) {
      const error = data.errors[0];
      throw new Error(`D1 API error: ${error.code} - ${error.message}`);
    }

    return {
      results: data.result?.[0]?.results || [],
      success: data.result?.[0]?.success || false,
      meta: data.result?.[0]?.meta,
    };
  }
}
