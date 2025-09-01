/**
 * Modern Service Factory - Cloudflare Worker Native
 * Creates and configures all services with optimal performance
 */

import { AuthMiddleware } from "../auth/auth-middleware.js";
import type { AppConfig, Services, WorkerEnv } from "../types/index.js";
import { RAGService } from "./rag.js";
import { RateLimitService } from "./rate-limit.js";
import { ToolCallLogger } from "./tool-call-logger.js";

/**
 * Create all services from Worker environment
 */
export async function createServices(env: WorkerEnv): Promise<Services> {
  // Convert Worker env to app config
  const config = createAppConfig(env);

  // Initialize services (RAG creates its own database and embedding instances)
  const auth = new AuthMiddleware(env.DB);
  const rag = new RAGService(config);
  const rateLimit = new RateLimitService(env.DB);
  const logger = new ToolCallLogger(env.DB);

  // Initialize async services
  await rag.initialize();

  return {
    rag,
    auth,
    database: rag.database,
    embedding: rag.embedding,
    rateLimit,
    logger,
  };
}

/**
 * Convert Worker environment to app configuration
 */
function createAppConfig(env: WorkerEnv): AppConfig {
  return {
    RAG_DB_HOST: env.RAG_DB_HOST,
    RAG_DB_PORT: parseInt(env.RAG_DB_PORT, 10),
    RAG_DB_DATABASE: env.RAG_DB_DATABASE,
    RAG_DB_USER: env.RAG_DB_USER,
    RAG_DB_PASSWORD: env.RAG_DB_PASSWORD,
    RAG_DB_SSLMODE: env.RAG_DB_SSLMODE,
    SILICONFLOW_API_KEY: env.SILICONFLOW_API_KEY,
    SILICONFLOW_TIMEOUT: parseInt(env.SILICONFLOW_TIMEOUT, 10),
  };
}
