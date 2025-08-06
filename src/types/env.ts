/**
 * Modern VPS Configuration Interface
 * Type-safe environment configuration for Node.js deployment
 */
export interface AppConfig {
  // Server Configuration
  PORT: number;
  NODE_ENV: 'development' | 'production';

  // Cloudflare D1 Configuration (for token validation)
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
  CLOUDFLARE_D1_DATABASE_ID: string;

  // SiliconFlow API Configuration
  SILICONFLOW_API_KEY: string;
  SILICONFLOW_TIMEOUT: number;

  // Database Configuration (for embeddings only)
  EMBEDDING_DB_HOST: string;
  EMBEDDING_DB_PORT: number;
  EMBEDDING_DB_DATABASE: string;
  EMBEDDING_DB_USER: string;
  EMBEDDING_DB_PASSWORD: string;
  EMBEDDING_DB_SSLMODE: 'disable' | 'require';

  // Search Configuration
  USE_HYBRID_SEARCH: boolean;

  // Session Configuration
  SESSION_SECRET: string;
  SESSION_TIMEOUT: number;
}
