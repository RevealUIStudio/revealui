#!/bin/bash

# Staging Deployment Script
# Handles deploying to staging environment for performance testing
#
# Usage:
#   ./scripts/agent/staging-deploy.sh [target]
#
# Targets:
#   vercel   - Deploy to Vercel (default)
#   railway  - Deploy to Railway
#   docker   - Build and push Docker image
#   render   - Deploy to Render
#
# Environment Variables:
#   STAGING_URL      - Staging URL for health checks
#   VERCEL_TOKEN     - Vercel authentication token
#   RAILWAY_TOKEN    - Railway authentication token
#   DOCKER_REGISTRY  - Docker registry URL
#   RENDER_API_KEY   - Render API key

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
TARGET="${1:-vercel}"
MAX_HEALTH_ATTEMPTS=10
HEALTH_CHECK_INTERVAL=10
BUILD_TIMEOUT=600

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Load environment variables
load_env() {
    local env_file="${1:-.env.staging}"
    if [ -f "$env_file" ]; then
        log_info "Loading environment from $env_file"
        # shellcheck disable=SC1090
        set -a
        source "$env_file"
        set +a
    else
        log_warning "No $env_file found, using current environment"
    fi
}

# Build the application
build_app() {
    log_info "Building application..."

    # Run build with timeout
    if timeout "$BUILD_TIMEOUT" pnpm build; then
        log_success "Build completed"
        return 0
    else
        log_error "Build failed or timed out"
        return 1
    fi
}

# Deploy to Vercel
deploy_vercel() {
    log_info "Deploying to Vercel staging..."

    if [ -z "${VERCEL_TOKEN:-}" ]; then
        log_warning "VERCEL_TOKEN not set, using interactive auth"
    fi

    local vercel_args=(--prod=false)

    if [ -n "${VERCEL_TOKEN:-}" ]; then
        vercel_args+=(--token="$VERCEL_TOKEN")
    fi

    if npx vercel "${vercel_args[@]}"; then
        log_success "Vercel deployment initiated"
        return 0
    else
        log_error "Vercel deployment failed"
        return 1
    fi
}

# Deploy to Railway
deploy_railway() {
    log_info "Deploying to Railway staging..."

    if ! command -v railway &> /dev/null; then
        log_info "Installing Railway CLI..."
        npm install -g @railway/cli
    fi

    if [ -z "${RAILWAY_TOKEN:-}" ]; then
        log_warning "RAILWAY_TOKEN not set, using interactive auth"
    else
        export RAILWAY_TOKEN
    fi

    if railway up --detach; then
        log_success "Railway deployment initiated"
        return 0
    else
        log_error "Railway deployment failed"
        return 1
    fi
}

# Build and deploy Docker image
deploy_docker() {
    log_info "Building and pushing Docker image..."

    local registry="${DOCKER_REGISTRY:-}"
    local image_name="${DOCKER_IMAGE_NAME:-revealui-cms}"
    local image_tag="staging-$(date +%Y%m%d-%H%M%S)"

    if [ -z "$registry" ]; then
        log_error "DOCKER_REGISTRY not set"
        return 1
    fi

    local full_image="$registry/$image_name:$image_tag"
    local latest_image="$registry/$image_name:staging"

    log_info "Building image: $full_image"

    if docker build -t "$full_image" -t "$latest_image" .; then
        log_success "Docker build completed"
    else
        log_error "Docker build failed"
        return 1
    fi

    log_info "Pushing to registry..."

    if docker push "$full_image" && docker push "$latest_image"; then
        log_success "Docker push completed"
        log_info "Image: $full_image"
        return 0
    else
        log_error "Docker push failed"
        return 1
    fi
}

# Deploy to Render
deploy_render() {
    log_info "Deploying to Render staging..."

    if [ -z "${RENDER_API_KEY:-}" ] || [ -z "${RENDER_SERVICE_ID:-}" ]; then
        log_error "RENDER_API_KEY and RENDER_SERVICE_ID must be set"
        return 1
    fi

    # Trigger a deploy via Render API
    local response
    response=$(curl -s -X POST \
        "https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys" \
        -H "Authorization: Bearer $RENDER_API_KEY" \
        -H "Content-Type: application/json")

    if echo "$response" | grep -q '"id"'; then
        log_success "Render deployment initiated"
        local deploy_id
        deploy_id=$(echo "$response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        log_info "Deploy ID: $deploy_id"
        return 0
    else
        log_error "Render deployment failed: $response"
        return 1
    fi
}

# Health check function
health_check() {
    local url="${STAGING_URL:-}"

    if [ -z "$url" ]; then
        log_warning "STAGING_URL not set, skipping health check"
        return 0
    fi

    local health_endpoint="$url/api/health"
    log_info "Performing health check: $health_endpoint"

    local attempt=1
    while [ $attempt -le $MAX_HEALTH_ATTEMPTS ]; do
        log_info "Health check attempt $attempt/$MAX_HEALTH_ATTEMPTS..."

        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" "$health_endpoint" 2>/dev/null || echo "000")

        if [ "$http_code" = "200" ]; then
            log_success "Health check passed!"
            log_info "Staging URL: $url"
            return 0
        fi

        log_info "HTTP status: $http_code, waiting ${HEALTH_CHECK_INTERVAL}s..."
        sleep "$HEALTH_CHECK_INTERVAL"
        ((attempt++))
    done

    log_error "Health check failed after $MAX_HEALTH_ATTEMPTS attempts"
    return 1
}

# Main deployment flow
main() {
    log_info "Starting staging deployment (target: $TARGET)"

    # Load environment
    load_env

    # Build application
    if ! build_app; then
        exit 1
    fi

    # Deploy based on target
    case "$TARGET" in
        vercel)
            deploy_vercel
            ;;
        railway)
            deploy_railway
            ;;
        docker)
            deploy_docker
            ;;
        render)
            deploy_render
            ;;
        *)
            log_error "Unknown target: $TARGET"
            log_info "Available targets: vercel, railway, docker, render"
            exit 1
            ;;
    esac

    local deploy_status=$?

    if [ $deploy_status -ne 0 ]; then
        log_error "Deployment failed"
        exit 1
    fi

    # Wait for deployment to propagate
    log_info "Waiting for deployment to propagate..."
    sleep 30

    # Health check
    if health_check; then
        log_success "Staging deployment successful!"
        exit 0
    else
        log_error "Staging deployment completed but health check failed"
        exit 1
    fi
}

# Show help
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    cat << EOF
Staging Deployment Script

Usage: ./scripts/agent/staging-deploy.sh [target]

Targets:
  vercel   - Deploy to Vercel (default)
  railway  - Deploy to Railway
  docker   - Build and push Docker image
  render   - Deploy to Render

Environment Variables:
  STAGING_URL      - Staging URL for health checks
  VERCEL_TOKEN     - Vercel authentication token
  RAILWAY_TOKEN    - Railway authentication token
  DOCKER_REGISTRY  - Docker registry URL
  DOCKER_IMAGE_NAME - Docker image name (default: revealui-cms)
  RENDER_API_KEY   - Render API key
  RENDER_SERVICE_ID - Render service ID

Example:
  STAGING_URL=https://staging.example.com ./scripts/agent/staging-deploy.sh vercel

EOF
    exit 0
fi

main "$@"
