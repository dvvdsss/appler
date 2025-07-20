/**
 * NEON Cloud Database Configuration
 * 优雅现代的NEON PostgreSQL配置
 */

export interface NEONConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  max_connections: number;
  connection_timeout: number;
}

export function createNEONConfig(env: any): NEONConfig {
  const config = {
    host: env.NEON_HOST,
    port: parseInt(env.NEON_PORT || "5432"),
    database: env.NEON_DATABASE,
    user: env.NEON_USER,
    password: env.NEON_PASSWORD,
    ssl: true,
    max_connections: 10,
    connection_timeout: 60000,
  };

  // 验证必需的环境变量
  if (!config.host) {
    throw new Error("NEON_HOST is required");
  }
  if (!config.database) {
    throw new Error("NEON_DATABASE is required");
  }
  if (!config.user) {
    throw new Error("NEON_USER is required");
  }
  if (!config.password) {
    throw new Error("NEON_PASSWORD is required");
  }

  return config;
}

export function getConnectionString(config: NEONConfig): string {
  return `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}?sslmode=require`;
}
