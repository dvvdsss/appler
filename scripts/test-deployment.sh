#!/bin/bash

# Apple RAG MCP Server - Deployment Testing Script
# Comprehensive testing suite for VPS deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
SERVER_URL="http://localhost:3000"
TIMEOUT=10

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

# Test functions
test_health_check() {
    log_info "Testing health check endpoint..."
    
    response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$SERVER_URL/health" --max-time $TIMEOUT)
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        log_success "Health check passed (HTTP $http_code)"
        
        # Check response content
        if jq -e '.status == "healthy"' /tmp/health_response.json > /dev/null 2>&1; then
            log_success "Health check response is valid"
            jq '.' /tmp/health_response.json
        else
            log_warning "Health check response format unexpected"
        fi
    else
        log_error "Health check failed (HTTP $http_code)"
        return 1
    fi
}

test_mcp_initialize() {
    log_info "Testing MCP initialize..."
    
    response=$(curl -s -w "%{http_code}" -o /tmp/init_response.json \
        -X POST "$SERVER_URL/" \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{}}}' \
        --max-time $TIMEOUT)
    
    http_code="${response: -3}"
    
    if [ "$http_code" = "200" ]; then
        log_success "MCP initialize passed (HTTP $http_code)"
        
        # Check response content
        if jq -e '.result.protocolVersion == "2025-06-18"' /tmp/init_response.json > /dev/null 2>&1; then
            log_success "MCP protocol version is correct"
        else
            log_warning "MCP protocol version unexpected"
        fi
        
        if jq -e '.result.serverInfo.name' /tmp/init_response.json > /dev/null 2>&1; then
            server_name=$(jq -r '.result.serverInfo.name' /tmp/init_response.json)
            log_success "Server name: $server_name"
        fi
    else
        log_error "MCP initialize failed (HTTP $http_code)"
        return 1
    fi
}

# Main test execution
main() {
    echo "🧪 Apple RAG MCP Server - Deployment Test Suite"
    echo "=============================================="
    echo ""
    
    # Check if server is running
    log_info "Checking if server is accessible..."
    if ! curl -s "$SERVER_URL/health" > /dev/null 2>&1; then
        log_error "Server is not accessible at $SERVER_URL"
        log_info "Please make sure the server is running"
        exit 1
    fi
    
    log_success "Server is accessible"
    echo ""
    
    # Run tests
    test_health_check
    echo ""
    
    test_mcp_initialize
    echo ""
    
    # Summary
    log_success "🎉 Core tests completed!"
    
    # Cleanup
    rm -f /tmp/health_response.json /tmp/init_response.json
}

# Run main function
main "$@"
