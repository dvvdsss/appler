/**
 * Modern Configuration Management
 * Environment-aware configuration with validation
 */

import type { AppConfig } from "./types/env.js";

/**
 * Load and validate application configuration
 */
export const loadConfig = (): AppConfig => {
  const config: AppConfig = {
    // Server Configuration
    PORT: parseInt(process.env.PORT || "3001", 10),
    NODE_ENV:
      (process.env.NODE_ENV as "development" | "production") || "development",

    // Cloudflare D1 Configuration (for token validation)
    CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || "",
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || "",
    CLOUDFLARE_D1_DATABASE_ID: process.env.CLOUDFLARE_D1_DATABASE_ID || "",

    // SiliconFlow API Configuration
    SILICONFLOW_API_KEY: process.env.SILICONFLOW_API_KEY || "demo-key",
    SILICONFLOW_TIMEOUT: parseInt(process.env.SILICONFLOW_TIMEOUT || "30", 10),

    // Database Configuration (for embeddings only)
    EMBEDDING_DB_HOST: process.env.EMBEDDING_DB_HOST || "localhost",
    EMBEDDING_DB_PORT: parseInt(process.env.EMBEDDING_DB_PORT || "5432", 10),
    EMBEDDING_DB_DATABASE: process.env.EMBEDDING_DB_DATABASE || "apple_rag_db",
    EMBEDDING_DB_USER: process.env.EMBEDDING_DB_USER || "apple_rag_user",
    EMBEDDING_DB_PASSWORD: process.env.EMBEDDING_DB_PASSWORD || "password",
    EMBEDDING_DB_SSLMODE:
      (process.env.EMBEDDING_DB_SSLMODE as "disable" | "require") || "disable",

    // Session Configuration
    SESSION_SECRET: process.env.SESSION_SECRET || "apple-rag-mcp-secret-key",
    SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT || "1800", 10), // 30 minutes

    // Security Configuration
    SECURITY_WEBHOOK_URL: process.env.SECURITY_WEBHOOK_URL,
    SECURITY_MAX_REQUESTS_PER_MINUTE: parseInt(process.env.SECURITY_MAX_REQUESTS_PER_MINUTE || "30", 10),
  };

  // Validate configuration
  validateConfig(config);

  return config;
};

/**
 * Validate configuration values
 */
const validateConfig = (config: AppConfig): void => {
  const errors: string[] = [];

  if (config.PORT < 1 || config.PORT > 65535) {
    errors.push(`Invalid PORT: ${config.PORT}. Must be between 1 and 65535.`);
  }

  if (config.SILICONFLOW_TIMEOUT < 1 || config.SILICONFLOW_TIMEOUT > 300) {
    errors.push(
      `Invalid SILICONFLOW_TIMEOUT: ${config.SILICONFLOW_TIMEOUT}. Must be between 1 and 300 seconds.`
    );
  }

  if (config.SESSION_TIMEOUT < 60 || config.SESSION_TIMEOUT > 86400) {
    errors.push(
      `Invalid SESSION_TIMEOUT: ${config.SESSION_TIMEOUT}. Must be between 60 and 86400 seconds.`
    );
  }

  if (
    config.NODE_ENV === "production" &&
    config.SESSION_SECRET === "apple-rag-mcp-secret-key"
  ) {
    errors.push("SESSION_SECRET must be set to a secure value in production");
  }

  // Validate required Cloudflare D1 configuration
  const requiredD1Fields = [
    { field: "CLOUDFLARE_ACCOUNT_ID", value: config.CLOUDFLARE_ACCOUNT_ID },
    { field: "CLOUDFLARE_API_TOKEN", value: config.CLOUDFLARE_API_TOKEN },
    {
      field: "CLOUDFLARE_D1_DATABASE_ID",
      value: config.CLOUDFLARE_D1_DATABASE_ID,
    },
  ];

  for (const { field, value } of requiredD1Fields) {
    if (!value) {
      errors.push(`${field} is required for token validation`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join("\n")}`);
  }
};

/**
 * Get database connection URL
 */
export const getDatabaseUrl = (config: AppConfig): string => {
  const {
    EMBEDDING_DB_HOST,
    EMBEDDING_DB_PORT,
    EMBEDDING_DB_DATABASE,
    EMBEDDING_DB_USER,
    EMBEDDING_DB_PASSWORD,
    EMBEDDING_DB_SSLMODE,
  } = config;

  return `postgresql://${encodeURIComponent(EMBEDDING_DB_USER)}:${encodeURIComponent(EMBEDDING_DB_PASSWORD)}@${EMBEDDING_DB_HOST}:${EMBEDDING_DB_PORT}/${EMBEDDING_DB_DATABASE}?sslmode=${EMBEDDING_DB_SSLMODE}`;
};
