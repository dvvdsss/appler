#!/bin/bash

# Apple RAG MCP Server - Unified Test Runner
# Runs all tests in organized categories for comprehensive validation

set -e

echo "🧪 Apple RAG MCP Server - Unified Test Suite"
echo "============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Test categories
CORE_TESTS=(
    "test-basic-mcp.js"
    "test-ping.js"
    "test-progress.js"
)

FUNCTIONALITY_TESTS=(
    "test-final-rag.js"
    "test-semantic-search.js"
    "test-core-search.js"
)

SECURITY_TESTS=(
    "test-security.js"
    "test-authorization.js"
    "test-cancellation.js"
)

ADVANCED_TESTS=(
    "test-streamable-http.js"
    "test-real-rag.js"
    "test-real-rag-mock.js"
)

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FAILED_TEST_NAMES=()

# Function to run a single test
run_test() {
    local test_file=$1
    local test_name=$(basename "$test_file" .js)
    
    echo ""
    log_info "Running: $test_name"
    echo "----------------------------------------"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if cd tests && node "$test_file" 2>&1; then
        log_success "$test_name PASSED"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        cd ..
    else
        log_error "$test_name FAILED"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_TEST_NAMES+=("$test_name")
        cd ..
    fi
}

# Function to run test category
run_test_category() {
    local category_name=$1
    shift
    local tests=("$@")
    
    echo ""
    echo "🔍 $category_name"
    echo "================================"
    
    for test in "${tests[@]}"; do
        if [ -f "tests/$test" ]; then
            run_test "$test"
        else
            log_warning "Test file not found: $test"
        fi
    done
}

# Check if server is running
check_server() {
    log_info "Checking if MCP server is running..."
    
    if curl -f -s http://localhost:3001/health > /dev/null 2>&1; then
        log_success "MCP server is running"
        return 0
    else
        log_error "MCP server is not running"
        log_info "Please start the server with: pnpm dev"
        return 1
    fi
}

# Main test execution
main() {
    # Parse command line arguments
    CATEGORY=""
    SETUP_DATA=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --category)
                CATEGORY="$2"
                shift 2
                ;;
            --setup-data)
                SETUP_DATA=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --category CATEGORY  Run specific test category (core|functionality|security|advanced)"
                echo "  --setup-data         Setup test data before running tests"
                echo "  --help              Show this help message"
                echo ""
                echo "Categories:"
                echo "  core         - Basic MCP protocol tests"
                echo "  functionality - RAG and search functionality tests"
                echo "  security     - Security and authorization tests"
                echo "  advanced     - Advanced features and edge cases"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Check if we're in the correct directory
    if [ ! -f "package.json" ]; then
        log_error "Please run this script from the project root directory"
        exit 1
    fi
    
    # Check server status
    if ! check_server; then
        exit 1
    fi
    
    # Setup test data if requested
    if [ "$SETUP_DATA" = true ]; then
        log_info "Setting up test data..."
        if cd tests && node setup-test-data.js; then
            log_success "Test data setup completed"
            cd ..
        else
            log_error "Test data setup failed"
            cd ..
            exit 1
        fi
    fi
    
    # Run tests based on category
    case "$CATEGORY" in
        "core")
            run_test_category "Core MCP Protocol Tests" "${CORE_TESTS[@]}"
            ;;
        "functionality")
            run_test_category "Functionality Tests" "${FUNCTIONALITY_TESTS[@]}"
            ;;
        "security")
            run_test_category "Security Tests" "${SECURITY_TESTS[@]}"
            ;;
        "advanced")
            run_test_category "Advanced Tests" "${ADVANCED_TESTS[@]}"
            ;;
        "")
            # Run all tests
            run_test_category "Core MCP Protocol Tests" "${CORE_TESTS[@]}"
            run_test_category "Functionality Tests" "${FUNCTIONALITY_TESTS[@]}"
            run_test_category "Security Tests" "${SECURITY_TESTS[@]}"
            run_test_category "Advanced Tests" "${ADVANCED_TESTS[@]}"
            ;;
        *)
            log_error "Unknown category: $CATEGORY"
            log_info "Available categories: core, functionality, security, advanced"
            exit 1
            ;;
    esac
    
    # Test summary
    echo ""
    echo "📊 Test Summary"
    echo "==============="
    log_info "Total tests: $TOTAL_TESTS"
    log_success "Passed: $PASSED_TESTS"
    
    if [ $FAILED_TESTS -gt 0 ]; then
        log_error "Failed: $FAILED_TESTS"
        echo ""
        log_error "Failed tests:"
        for failed_test in "${FAILED_TEST_NAMES[@]}"; do
            echo "  - $failed_test"
        done
        echo ""
        log_error "Some tests failed. Please check the output above for details."
        exit 1
    else
        echo ""
        log_success "🎉 All tests passed!"
        exit 0
    fi
}

# Run main function with all arguments
main "$@"
