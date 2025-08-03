#!/bin/bash

# Apple RAG MCP Server - VPS Deployment Script
# Modern, automated deployment for production environments

set -e  # Exit on any error

echo "🚀 Apple RAG MCP Server - VPS Deployment"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Check if .env file exists
if [ ! -f ".env" ]; then
    log_error ".env file not found!"
    log_info "Please copy .env.example to .env and configure your settings"
    exit 1
fi

log_success ".env file found"

# Install dependencies
log_info "Installing dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v npm &> /dev/null; then
    npm install
else
    log_error "Neither pnpm nor npm found. Please install Node.js and npm/pnpm"
    exit 1
fi
log_success "Dependencies installed"

# Build the project
log_info "Building TypeScript project..."
if command -v pnpm &> /dev/null; then
    pnpm run build
else
    npm run build
fi
log_success "Project built successfully"

# Create logs directory
log_info "Creating logs directory..."
mkdir -p logs
log_success "Logs directory created"

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 not found. Installing PM2 globally..."
    npm install -g pm2
    log_success "PM2 installed"
fi

# Stop existing PM2 process if running
log_info "Stopping existing PM2 processes..."
pm2 stop apple-rag-mcp 2>/dev/null || true
pm2 delete apple-rag-mcp 2>/dev/null || true
log_success "Existing processes stopped"

# Start the application with PM2
log_info "Starting application with PM2..."
pm2 start ecosystem.config.js --env production
log_success "Application started with PM2"

# Save PM2 configuration
log_info "Saving PM2 configuration..."
pm2 save
log_success "PM2 configuration saved"

# Setup PM2 startup script
log_info "Setting up PM2 startup script..."
pm2 startup | tail -n 1 | bash || log_warning "PM2 startup setup may require manual configuration"

# Show status
echo ""
log_success "🎉 Deployment completed successfully!"
echo ""
log_info "Application Status:"
pm2 status

echo ""
log_info "Useful Commands:"
echo "  📊 View logs:     pm2 logs apple-rag-mcp"
echo "  🔄 Restart:       pm2 restart apple-rag-mcp"
echo "  ⏹️  Stop:          pm2 stop apple-rag-mcp"
echo "  📈 Monitor:       pm2 monit"
echo "  🔍 Status:        pm2 status"

echo ""
log_success "🌐 Server should be running on http://localhost:3000"
log_info "Health check: curl http://localhost:3000/health"
