/**
 * PM2 Production Configuration
 * Optimized for VPS deployment with clustering and monitoring
 */

module.exports = {
  apps: [{
    name: 'apple-rag-mcp',
    script: 'dist/server.js',
    
    // Clustering Configuration
    instances: 'max',           // Use all CPU cores
    exec_mode: 'cluster',       // Enable cluster mode
    
    // Environment Configuration
    // Note: NODE_ENV will be loaded from .env file
    // PM2 will use the .env file in the project directory
    env: {
      PORT: 3001,
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3001,
    },
    
    // Performance Configuration
    max_memory_restart: '1G',   // Restart if memory exceeds 1GB
    min_uptime: '10s',          // Minimum uptime before considering stable
    max_restarts: 10,           // Maximum restart attempts
    restart_delay: 4000,        // Delay between restarts
    
    // Logging Configuration
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Monitoring Configuration
    watch: false,               // Don't watch files in production
    ignore_watch: ['node_modules', 'logs', '.git'],
    
    // Auto-restart Configuration
    autorestart: true,
    
    // Health Check
    health_check_grace_period: 3000,
    
    // Advanced Options
    kill_timeout: 5000,         // Time to wait before force killing
    listen_timeout: 3000,       // Time to wait for app to listen
    
    // Source Map Support
    source_map_support: true,
    
    // Instance Variables
    instance_var: 'INSTANCE_ID',
  }],
  
  // Deployment Configuration (Optional)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/your-username/apple-rag-mcp.git',
      path: '/var/www/apple-rag-mcp',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};
