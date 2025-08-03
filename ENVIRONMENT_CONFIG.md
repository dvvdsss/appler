# Environment Configuration Guide

## Overview

This project uses different environment configurations for development and production environments.

## Environment Files

### 1. Development Environment (`.env`)
- **Purpose**: Local development on developer machines
- **Database**: Remote PostgreSQL server at `198.12.70.36`
- **Node Environment**: `development`
- **Usage**: Used when running `pnpm dev` locally

### 2. Production Environment (`.env.production`)
- **Purpose**: Production deployment on VPS server
- **Database**: Local PostgreSQL server at `localhost`
- **Node Environment**: `production`
- **Usage**: Copy to `.env` on production server

## Key Differences

| Configuration | Development | Production |
|---------------|-------------|------------|
| **NODE_ENV** | `development` | `production` |
| **Database Host** | `198.12.70.36` | `localhost` |
| **Session Secret** | Development secret | Production secret |
| **SSL Mode** | `disable` | `disable` (can enable) |
| **Logging** | Debug level | Info level |

## Database Configuration

### Development Environment
```env
EMBEDDING_DB_HOST=198.12.70.36  # Remote database server
EMBEDDING_DB_PORT=5432
EMBEDDING_DB_DATABASE=apple_rag_db
EMBEDDING_DB_USER=apple_rag_user
EMBEDDING_DB_PASSWORD=kywI4KodlZzyHp2
EMBEDDING_DB_SSLMODE=disable
```

### Production Environment
```env
EMBEDDING_DB_HOST=localhost      # Local database on same server
EMBEDDING_DB_PORT=5432
EMBEDDING_DB_DATABASE=apple_rag_db
EMBEDDING_DB_USER=apple_rag_user
EMBEDDING_DB_PASSWORD=kywI4KodlZzyHp2
EMBEDDING_DB_SSLMODE=disable     # Can be changed to 'require' for SSL
```

## Deployment Instructions

### For Development
1. Use the existing `.env` file
2. Ensure remote database `198.12.70.36` is accessible
3. Run `pnpm dev`

### For Production Deployment
1. Copy `.env.production` to the VPS server
2. Rename it to `.env` on the server
3. Ensure PostgreSQL is installed and running locally on the VPS
4. Set up the database schema and data
5. Run `pnpm build && pnpm start`

## Security Considerations

### Development
- Uses development session secret
- Remote database connection
- Debug logging enabled
- CORS may be more permissive

### Production
- Uses production session secret
- Local database for better security
- Info-level logging only
- Stricter CORS policies
- Optional SSL for database connections

## Environment Variables Explanation

### Core Configuration
- `NODE_ENV`: Determines the runtime environment
- `PORT`: Server port (default: 3001)

### API Configuration
- `SILICONFLOW_API_KEY`: API key for embedding service
- `SILICONFLOW_TIMEOUT`: API request timeout

### Database Configuration
- `EMBEDDING_DB_HOST`: Database server hostname
- `EMBEDDING_DB_PORT`: Database port
- `EMBEDDING_DB_DATABASE`: Database name
- `EMBEDDING_DB_USER`: Database username
- `EMBEDDING_DB_PASSWORD`: Database password
- `EMBEDDING_DB_SSLMODE`: SSL mode for database connection

### Session Configuration
- `SESSION_SECRET`: Secret key for session encryption
- `SESSION_TIMEOUT`: Session timeout in seconds

### Optional Production Settings
- `LOG_LEVEL`: Logging level (debug, info, warn, error)
- `LOG_FORMAT`: Log format (text, json)
- `MAX_CONCURRENT_REQUESTS`: Maximum concurrent requests
- `REQUEST_TIMEOUT`: Request timeout in milliseconds
- `EMBEDDING_CACHE_TTL`: Embedding cache time-to-live

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check if the database host is correct for your environment
   - Verify database credentials
   - Ensure database server is running

2. **Environment Mismatch**
   - Verify `NODE_ENV` matches your actual environment
   - Check database host configuration
   - Ensure correct `.env` file is being used

3. **API Key Issues**
   - Verify `SILICONFLOW_API_KEY` is valid
   - Check API quota and limits

### Verification Commands

```bash
# Check current environment
echo $NODE_ENV

# Test database connection
psql -h $EMBEDDING_DB_HOST -p $EMBEDDING_DB_PORT -U $EMBEDDING_DB_USER -d $EMBEDDING_DB_DATABASE -c "SELECT 1;"

# Check server health
curl http://localhost:3001/health
```

## Best Practices

1. **Never commit `.env` files to version control**
2. **Use different secrets for different environments**
3. **Regularly rotate API keys and secrets**
4. **Use SSL in production when possible**
5. **Monitor database connections and performance**
6. **Keep environment configurations documented and up-to-date**
