#!/bin/bash

# Apple RAG MCP Server - Deployment Verification Script
# Verifies that the deployment is ready and all components are working

set -e

echo "🔍 Apple RAG MCP Server - Deployment Verification"
echo "================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run this script from the project root."
    exit 1
fi

log_success "Project directory verified"

# Check if .env file exists and has correct configuration
if [ ! -f ".env" ]; then
    log_error ".env file not found"
    exit 1
fi

log_success ".env file found"

# Check NODE_ENV setting
if grep -q "NODE_ENV=production" .env; then
    log_success "NODE_ENV set to production"
elif grep -q "NODE_ENV=development" .env; then
    log_warning "NODE_ENV set to development (this is OK for local testing)"
else
    log_error "NODE_ENV not properly set in .env"
    exit 1
fi

# Check if SiliconFlow API key is set
if grep -q "SILICONFLOW_API_KEY=sk-" .env; then
    log_success "SiliconFlow API key configured"
else
    log_warning "SiliconFlow API key may not be configured"
fi

# Check if TypeScript build is successful
echo "🔨 Checking TypeScript build..."
if [ ! -f "dist/server.js" ]; then
    log_error "Build output not found. Running build..."
    pnpm build
fi

if [ -f "dist/server.js" ]; then
    log_success "TypeScript build successful"
else
    log_error "TypeScript build failed"
    exit 1
fi

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    log_success "PM2 is available"
else
    log_warning "PM2 not found. Install with: npm install -g pm2"
fi

# Check ecosystem.config.cjs
if [ -f "ecosystem.config.cjs" ]; then
    log_success "PM2 ecosystem configuration found"
else
    log_error "PM2 ecosystem configuration missing"
    exit 1
fi

# Verify package.json scripts
if grep -q "start:prod" package.json; then
    log_success "start:prod script found"
else
    log_error "start:prod script missing in package.json"
    exit 1
fi

# Check dependencies
echo "📦 Checking dependencies..."
if [ -d "node_modules" ]; then
    log_success "Dependencies installed"
else
    log_warning "Dependencies not installed. Run: pnpm install"
fi

# Check logs directory
if [ ! -d "logs" ]; then
    echo "📁 Creating logs directory..."
    mkdir -p logs
    log_success "Logs directory created"
else
    log_success "Logs directory exists"
fi

echo ""
echo "🎯 Deployment Readiness Summary:"
echo "================================"

# Final readiness check
READY=true

# Check critical files
for file in "dist/server.js" "ecosystem.config.cjs" ".env"; do
    if [ ! -f "$file" ]; then
        log_error "Missing critical file: $file"
        READY=false
    fi
done

if [ "$READY" = true ]; then
    log_success "🎉 Deployment is ready!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Start production server: pnpm start:prod"
    echo "  2. Or use deployment script: ./deploy.sh"
    echo "  3. Check status: pm2 status"
    echo "  4. View logs: pm2 logs apple-rag-mcp"
    echo "  5. Health check: curl http://localhost:3001/health"
    echo ""
    echo "🔧 Useful commands:"
    echo "  - Restart: pm2 restart apple-rag-mcp"
    echo "  - Stop: pm2 stop apple-rag-mcp"
    echo "  - Monitor: pm2 monit"
else
    log_error "Deployment is not ready. Please fix the issues above."
    exit 1
fi
