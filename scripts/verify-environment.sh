#!/bin/bash

# Environment Configuration Verification Script
# Ensures proper environment isolation and configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🔍 Environment Configuration Verification - Wrangler 4.x"
echo "============================================================"
echo "📋 Supported Environments: development | production"
echo "🚫 No local/test environments - Remote databases only"
echo "⚡ Wrangler 4.x with experimental_remote = true"
echo ""

# Check NODE_ENV
NODE_ENV=${NODE_ENV:-development}
log_info "Current NODE_ENV: $NODE_ENV"

# Check Wrangler version
if command -v wrangler &> /dev/null; then
    WRANGLER_VERSION=$(wrangler --version 2>/dev/null | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' | head -1)
    if [[ "$WRANGLER_VERSION" =~ ^4\. ]]; then
        log_success "Wrangler version: $WRANGLER_VERSION (4.x - Modern)"
    else
        log_error "Wrangler version: $WRANGLER_VERSION (Outdated - Requires 4.x)"
        exit 1
    fi
else
    log_warning "Wrangler not found in PATH"
fi

# Determine expected environment file
if [ "$NODE_ENV" = "production" ]; then
    ENV_FILE=".env.production"
    EXPECTED_DB_ID="6f3f8951-0eb8-4a63-a277-3d2fd8757705"
    EXPECTED_HOST="localhost"
else
    ENV_FILE=".env.development"
    EXPECTED_DB_ID="a63296ff-5954-445d-a84e-328bc61065f8"
    EXPECTED_HOST="198.12.70.36"
fi

log_info "Expected environment file: $ENV_FILE"

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file $ENV_FILE not found"
    exit 1
fi

log_success "Environment file found: $ENV_FILE"

# Load environment variables
source "$ENV_FILE"

# Verify database configuration
log_info "Verifying database configuration..."

if [ "$CLOUDFLARE_D1_DATABASE_ID" = "$EXPECTED_DB_ID" ]; then
    log_success "D1 Database ID correct for $NODE_ENV environment"
else
    log_error "D1 Database ID mismatch!"
    log_error "Expected: $EXPECTED_DB_ID"
    log_error "Actual: $CLOUDFLARE_D1_DATABASE_ID"
    exit 1
fi

if [ "$EMBEDDING_DB_HOST" = "$EXPECTED_HOST" ]; then
    log_success "Embedding DB host correct for $NODE_ENV environment"
else
    log_error "Embedding DB host mismatch!"
    log_error "Expected: $EXPECTED_HOST"
    log_error "Actual: $EMBEDDING_DB_HOST"
    exit 1
fi

# Verify required environment variables
log_info "Checking required environment variables..."

REQUIRED_VARS=(
    "CLOUDFLARE_ACCOUNT_ID"
    "CLOUDFLARE_API_TOKEN"
    "CLOUDFLARE_D1_DATABASE_ID"
    "SILICONFLOW_API_KEY"
    "EMBEDDING_DB_HOST"
    "EMBEDDING_DB_PORT"
    "EMBEDDING_DB_DATABASE"
    "EMBEDDING_DB_USER"
    "EMBEDDING_DB_PASSWORD"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Required environment variable $var is not set"
        exit 1
    else
        log_success "$var is set"
    fi
done

echo ""
log_success "🎉 Wrangler 4.x Environment configuration verification passed!"
echo ""
log_info "Environment Summary:"
echo "  NODE_ENV: $NODE_ENV"
echo "  Wrangler: $WRANGLER_VERSION (4.x Modern)"
echo "  D1 Database: ${CLOUDFLARE_D1_DATABASE_ID:0:8}... (Remote Only - experimental_remote: true)"
echo "  Embedding DB: $EMBEDDING_DB_HOST:$EMBEDDING_DB_PORT (Remote Only)"
echo "  Environment File: $ENV_FILE"
echo ""
log_info "⚡ Wrangler 4.x with experimental_remote - Zero local databases"
