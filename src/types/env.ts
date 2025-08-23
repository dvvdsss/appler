/**
 * Modern Type-Safe Configuration Interface
 * Immutable configuration for high-performance MCP server
 */
export interface AppConfig {
  // Server Configuration
  readonly PORT: number;
  readonly NODE_ENV: "development" | "production";

  // Cloudflare D1 Configuration (for token validation)
  readonly CLOUDFLARE_ACCOUNT_ID: string;
  readonly CLOUDFLARE_API_TOKEN: string;
  readonly CLOUDFLARE_D1_DATABASE_ID: string;

  // SiliconFlow API Configuration
  readonly SILICONFLOW_API_KEY: string;
  readonly SILICONFLOW_TIMEOUT: number;

  // Database Configuration (for embeddings only)
  readonly EMBEDDING_DB_HOST: string;
  readonly EMBEDDING_DB_PORT: number;
  readonly EMBEDDING_DB_DATABASE: string;
  readonly EMBEDDING_DB_USER: string;
  readonly EMBEDDING_DB_PASSWORD: string;
  readonly EMBEDDING_DB_SSLMODE: "disable" | "require";

  // Session Configuration
  readonly SESSION_SECRET: string;
  readonly SESSION_TIMEOUT: number;

  // Security Configuration
  readonly SECURITY_WEBHOOK_URL?: string;
  readonly SECURITY_MAX_REQUESTS_PER_MINUTE?: number;
}
