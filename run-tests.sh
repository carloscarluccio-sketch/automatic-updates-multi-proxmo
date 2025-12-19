#!/bin/bash

# Comprehensive Test Runner Script for Proxmox Multi-Tenant Platform
# Usage: ./run-tests.sh [option]
# Options: all, backend, frontend, e2e, unit, integration, coverage, watch

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to run backend tests
run_backend_tests() {
    print_info "Running backend tests..."
    cd backend
    npm test
    cd ..
    print_success "Backend tests completed!"
}

# Function to run frontend tests
run_frontend_tests() {
    print_info "Running frontend tests..."
    cd frontend
    npm test -- --watchAll=false
    cd ..
    print_success "Frontend tests completed!"
}

# Function to run E2E tests
run_e2e_tests() {
    print_info "Running E2E tests..."
    npx playwright test
    print_success "E2E tests completed!"
}

# Function to run unit tests only
run_unit_tests() {
    print_info "Running unit tests..."
    cd backend
    npm run test:unit
    cd ..
    print_success "Unit tests completed!"
}

# Function to run integration tests only
run_integration_tests() {
    print_info "Running integration tests..."
    cd backend
    npm run test:integration
    cd ..
    print_success "Integration tests completed!"
}

# Function to run tests with coverage
run_coverage() {
    print_info "Running tests with coverage..."

    # Backend coverage
    print_info "Generating backend coverage..."
    cd backend
    npm run test:coverage
    cd ..

    # Frontend coverage
    print_info "Generating frontend coverage..."
    cd frontend
    npm test -- --coverage --watchAll=false
    cd ..

    print_success "Coverage reports generated!"
    print_info "Backend coverage: backend/coverage/index.html"
    print_info "Frontend coverage: frontend/coverage/index.html"
}

# Function to run tests in watch mode
run_watch() {
    print_info "Running tests in watch mode..."
    print_warning "Press Ctrl+C to exit"
    cd backend
    npm run test:watch
}

# Function to run all tests
run_all_tests() {
    print_info "Running ALL tests (Backend + Frontend + E2E)..."

    run_backend_tests
    run_frontend_tests
    run_e2e_tests

    print_success "All tests completed successfully!"
}

# Main script logic
case "${1:-all}" in
    all)
        run_all_tests
        ;;
    backend)
        run_backend_tests
        ;;
    frontend)
        run_frontend_tests
        ;;
    e2e)
        run_e2e_tests
        ;;
    unit)
        run_unit_tests
        ;;
    integration)
        run_integration_tests
        ;;
    coverage)
        run_coverage
        ;;
    watch)
        run_watch
        ;;
    *)
        print_error "Invalid option: $1"
        echo ""
        echo "Usage: ./run-tests.sh [option]"
        echo ""
        echo "Options:"
        echo "  all          - Run all tests (backend + frontend + e2e)"
        echo "  backend      - Run backend tests only"
        echo "  frontend     - Run frontend tests only"
        echo "  e2e          - Run E2E tests only"
        echo "  unit         - Run unit tests only"
        echo "  integration  - Run integration tests only"
        echo "  coverage     - Generate coverage reports"
        echo "  watch        - Run tests in watch mode"
        echo ""
        exit 1
        ;;
esac
