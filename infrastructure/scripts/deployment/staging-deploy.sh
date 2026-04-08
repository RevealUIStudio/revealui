#!/bin/bash
# =============================================================================
# Staging Deployment Script
# =============================================================================
# Handles deploying to staging environment for performance testing
#
# Usage:
#   ./scripts/agent/staging-deploy.sh [command] [options]
#
# Commands:
#   vercel   - Deploy to Vercel (default)
#   railway  - Deploy to Railway
#   docker   - Build and push Docker image
#   render   - Deploy to Render
#   status   - Check deployment status
#   help     - Show this help
#
# Options:
#   --json       Output in JSON format (for automation)
#   --no-color   Disable colored output
#   --skip-build Skip the build step
#   --skip-health Skip health check after deployment
#   --verbose    Show detailed output
#
# Environment Variables:
#   STAGING_URL      - Staging URL for health checks
#   VERCEL_TOKEN     - Vercel authentication token
#   RAILWAY_TOKEN    - Railway authentication token
#   DOCKER_REGISTRY  - Docker registry URL
#   RENDER_API_KEY   - Render API key
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

# Additional flags
SKIP_BUILD=false
SKIP_HEALTH=false

# Default configuration
MAX_HEALTH_ATTEMPTS=10
HEALTH_CHECK_INTERVAL=10
BUILD_TIMEOUT=600

# Parse additional flags
parse_deploy_flags() {
  local args=("$@")
  local remaining=()

  for arg in "${args[@]}"; do
    case "$arg" in
      --skip-build)
        SKIP_BUILD=true
        ;;
      --skip-health)
        SKIP_HEALTH=true
        ;;
      *)
        remaining+=("$arg")
        ;;
    esac
  done

  REMAINING_ARGS=("${remaining[@]}")
}

show_help() {
  if [ "$JSON_MODE" = "true" ]; then
    json_success '{"command": "help", "message": "Use --help without --json for usage information"}'
    exit $EXIT_SUCCESS
  fi

  cat << 'EOF'
Staging Deployment Script

Usage: ./scripts/agent/staging-deploy.sh [command] [options]

Commands:
  vercel   - Deploy to Vercel (default)
  railway  - Deploy to Railway
  docker   - Build and push Docker image
  render   - Deploy to Render
  status   - Check deployment status
  help     - Show this help

Options:
  --json       Output in JSON format (for automation)
  --no-color   Disable colored output
  --skip-build Skip the build step
  --skip-health Skip health check after deployment
  --verbose    Show detailed output

Environment Variables:
  STAGING_URL       - Staging URL for health checks
  VERCEL_TOKEN      - Vercel authentication token
  RAILWAY_TOKEN     - Railway authentication token
  DOCKER_REGISTRY   - Docker registry URL
  DOCKER_IMAGE_NAME - Docker image name (default: revealui-admin)
  RENDER_API_KEY    - Render API key
  RENDER_SERVICE_ID - Render service ID

Example:
  STAGING_URL=https://staging.example.com ./scripts/agent/staging-deploy.sh vercel
  ./scripts/agent/staging-deploy.sh status --json
EOF
}

# Load environment variables
load_env() {
  local env_file="${1:-.env.staging}"
  if [ -f "$env_file" ]; then
    log_info "Loading environment from $env_file"
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  else
    log_warning "No $env_file found, using current environment"
  fi
}

# Build the application
build_app() {
  if [ "$SKIP_BUILD" = "true" ]; then
    log_info "Skipping build step (--skip-build)"
    return 0
  fi

  log_info "Building application..."

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

  local deploy_url=""
  local output
  if output=$(npx vercel "${vercel_args[@]}" 2>&1); then
    deploy_url=$(echo "$output" | grep -oE 'https://[^ ]+' | head -1 || echo "")
    log_success "Vercel deployment initiated"
    echo "$deploy_url"
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
  local image_name="${DOCKER_IMAGE_NAME:-revealui-admin}"
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
    echo "$full_image"
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
    echo "$deploy_id"
    return 0
  else
    log_error "Render deployment failed: $response"
    return 1
  fi
}

# Health check function
health_check() {
  if [ "$SKIP_HEALTH" = "true" ]; then
    log_info "Skipping health check (--skip-health)"
    return 0
  fi

  local url="${STAGING_URL:-}"

  if [ -z "$url" ]; then
    log_warning "STAGING_URL not set, skipping health check"
    return 0
  fi

  local health_endpoint="$url/api/health"
  log_info "Performing health check: $health_endpoint"

  local attempt=1
  while [ $attempt -le $MAX_HEALTH_ATTEMPTS ]; do
    log_debug "Health check attempt $attempt/$MAX_HEALTH_ATTEMPTS..."

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$health_endpoint" 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ]; then
      log_success "Health check passed!"
      return 0
    fi

    log_debug "HTTP status: $http_code, waiting ${HEALTH_CHECK_INTERVAL}s..."
    sleep "$HEALTH_CHECK_INTERVAL"
    ((attempt++))
  done

  log_error "Health check failed after $MAX_HEALTH_ATTEMPTS attempts"
  return 1
}

# Check deployment status
check_status() {
  local url="${STAGING_URL:-}"

  if [ -z "$url" ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "CONFIG_ERROR" "STAGING_URL not set"
      exit $EXIT_CONFIG_ERROR
    else
      log_error "STAGING_URL not set"
      exit $EXIT_CONFIG_ERROR
    fi
  fi

  local health_endpoint="$url/api/health"
  local http_code
  local response_body

  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$health_endpoint" 2>/dev/null || echo "000")
  response_body=$(curl -s "$health_endpoint" 2>/dev/null || echo "{}")

  if [ "$JSON_MODE" = "true" ]; then
    json_success "{
      \"url\": \"$url\",
      \"healthEndpoint\": \"$health_endpoint\",
      \"httpStatus\": $http_code,
      \"healthy\": $([ "$http_code" = "200" ] && echo "true" || echo "false"),
      \"response\": $response_body
    }"
  else
    log_header "Deployment Status"

    echo "Staging URL: $url"
    echo "Health endpoint: $health_endpoint"
    echo "HTTP status: $http_code"

    if [ "$http_code" = "200" ]; then
      log_success "Deployment is healthy"
    else
      log_warning "Deployment may be unhealthy (HTTP $http_code)"
    fi
  fi
}

# Main deployment flow
run_deploy() {
  local target="$1"
  local deploy_result=""
  local deploy_status=0

  # Load environment
  load_env

  # Build application
  if ! build_app; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "EXECUTION_ERROR" "Build failed"
    fi
    exit $EXIT_EXECUTION_ERROR
  fi

  # Deploy based on target
  case "$target" in
    vercel)
      deploy_result=$(deploy_vercel) || deploy_status=$?
      ;;
    railway)
      deploy_result=$(deploy_railway) || deploy_status=$?
      ;;
    docker)
      deploy_result=$(deploy_docker) || deploy_status=$?
      ;;
    render)
      deploy_result=$(deploy_render) || deploy_status=$?
      ;;
    *)
      if [ "$JSON_MODE" = "true" ]; then
        json_error "VALIDATION_ERROR" "Unknown target: $target"
      else
        log_error "Unknown target: $target"
        log_info "Available targets: vercel, railway, docker, render"
      fi
      exit $EXIT_VALIDATION_ERROR
      ;;
  esac

  if [ $deploy_status -ne 0 ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "EXECUTION_ERROR" "Deployment to $target failed"
    else
      log_error "Deployment failed"
    fi
    exit $EXIT_EXECUTION_ERROR
  fi

  # Wait for deployment to propagate
  log_info "Waiting for deployment to propagate..."
  sleep 30

  # Health check
  local health_status=0
  health_check || health_status=$?

  if [ "$JSON_MODE" = "true" ]; then
    json_success "{
      \"target\": \"$target\",
      \"deployResult\": \"$deploy_result\",
      \"healthCheckPassed\": $([ $health_status -eq 0 ] && echo "true" || echo "false"),
      \"stagingUrl\": \"${STAGING_URL:-null}\"
    }"
  else
    if [ $health_status -eq 0 ]; then
      log_success "Staging deployment successful!"
    else
      log_warning "Staging deployment completed but health check failed"
    fi
  fi

  exit $health_status
}

# =============================================================================
# Main
# =============================================================================

# Parse common flags first
parse_common_flags "$@"
set -- "${REMAINING_ARGS[@]}"

# Parse deploy-specific flags
parse_deploy_flags "$@"
set -- "${REMAINING_ARGS[@]}"

# Get command
command="${1:-vercel}"

case "$command" in
  status)
    check_status
    ;;
  help|--help|-h)
    show_help
    ;;
  vercel|railway|docker|render)
    run_deploy "$command"
    ;;
  *)
    if [ "$JSON_MODE" = "true" ]; then
      json_error "VALIDATION_ERROR" "Unknown command: $command"
      exit $EXIT_VALIDATION_ERROR
    else
      log_error "Unknown command: $command"
      log_info "Use '$0 help' for usage information."
      exit $EXIT_VALIDATION_ERROR
    fi
    ;;
esac
