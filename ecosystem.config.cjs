/**
 * PM2 Production Configuration
 * Optimized for VPS deployment with clustering and monitoring
 */

module.exports = {
  apps: [
    {
      name: "apple-rag-mcp",
      script: "dist/server.js",

      // Multi-Instance Configuration (4 cores optimization)
      instances: 4, // 4 instances to fully utilize 4-core CPU
      exec_mode: "cluster", // Cluster mode for load balancing

      // Environment Configuration
      env: {
        NODE_ENV: "development",
        PORT: 3001,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3001,
      },

      // Environment file configuration - dynamically loaded by server.ts
      // No env_file specified to avoid conflicts with dynamic loading

      // Performance Configuration (4-instance optimization)
      max_memory_restart: "1.2G", // Restart if memory exceeds 1.2GB per instance
      min_uptime: "10s", // Minimum uptime before considering stable
      max_restarts: 10, // Maximum restart attempts
      restart_delay: 4000, // Delay between restarts

      // Logging Configuration
      log_file: "./logs/combined.log",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // Monitoring Configuration
      watch: false, // Don't watch files in production
      ignore_watch: ["node_modules", "logs", ".git"],

      // Auto-restart Configuration
      autorestart: true,

      // Health Check
      health_check_grace_period: 3000,

      // Advanced Options (Cluster Mode Optimized)
      kill_timeout: 8000, // Increased timeout for graceful shutdown
      listen_timeout: 8000, // Increased timeout for cluster startup

      // Source Map Support
      source_map_support: true,

      // Instance Variables
      instance_var: "INSTANCE_ID",
    },
  ],

  // Deployment Configuration (Optional)
  deploy: {
    production: {
      user: "deploy",
      host: "your-server.com",
      ref: "origin/main",
      repo: "https://github.com/your-username/apple-rag-mcp.git",
      path: "/var/www/apple-rag-mcp",
      "post-deploy":
        "npm install && npm run build && pm2 reload ecosystem.config.js --env production",
      env: {
        NODE_ENV: "production",
      },
    },
  },
};
