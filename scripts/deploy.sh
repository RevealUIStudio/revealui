#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE=${NAMESPACE:-"revealui"}
ENVIRONMENT=${ENVIRONMENT:-"production"}
VERSION=${VERSION:-"latest"}
TIMEOUT=${TIMEOUT:-"600"}

echo -e "${GREEN}RevealUI Deployment Script${NC}"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "Namespace: $NAMESPACE"
echo "Version: $VERSION"
echo "========================================="

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"

    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}Error: kubectl is not installed${NC}"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Error: docker is not installed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

# Build Docker images
build_images() {
    echo -e "\n${YELLOW}Building Docker images...${NC}"

    docker build -t revealui/admin:${VERSION} -f docker/Dockerfile.admin .
    docker build -t revealui/dashboard:${VERSION} -f docker/Dockerfile.dashboard .

    echo -e "${GREEN}✓ Docker images built successfully${NC}"
}

# Push Docker images
push_images() {
    echo -e "\n${YELLOW}Pushing Docker images...${NC}"

    docker push revealui/admin:${VERSION}
    docker push revealui/dashboard:${VERSION}

    echo -e "${GREEN}✓ Docker images pushed successfully${NC}"
}

# Apply Kubernetes configurations
apply_k8s_configs() {
    echo -e "\n${YELLOW}Applying Kubernetes configurations...${NC}"

    # Create namespace if it doesn't exist
    kubectl create namespace ${NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

    # Apply secrets and configmaps
    kubectl apply -f k8s/secrets.yaml -n ${NAMESPACE}

    # Apply StatefulSets
    kubectl apply -f k8s/statefulsets/ -n ${NAMESPACE}

    # Wait for databases to be ready
    echo "Waiting for databases to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n ${NAMESPACE} --timeout=${TIMEOUT}s || true

    echo -e "${GREEN}✓ Kubernetes configurations applied${NC}"
}

# Deploy applications
deploy_apps() {
    echo -e "\n${YELLOW}Deploying applications...${NC}"

    # Update image tags
    kubectl set image deployment/revealui-admin admin=revealui/admin:${VERSION} -n ${NAMESPACE}
    kubectl set image deployment/revealui-dashboard dashboard=revealui/dashboard:${VERSION} -n ${NAMESPACE}

    # Apply deployments
    kubectl apply -f k8s/deployments/ -n ${NAMESPACE}

    # Wait for rollout to complete
    echo "Waiting for Admin rollout..."
    kubectl rollout status deployment/revealui-admin -n ${NAMESPACE} --timeout=${TIMEOUT}s

    echo "Waiting for Dashboard rollout..."
    kubectl rollout status deployment/revealui-dashboard -n ${NAMESPACE} --timeout=${TIMEOUT}s

    echo -e "${GREEN}✓ Applications deployed successfully${NC}"
}

# Run database migrations
run_migrations() {
    echo -e "\n${YELLOW}Running database migrations...${NC}"

    # Create migration job
    kubectl run revealui-migrate-${VERSION} \
        --image=revealui/admin:${VERSION} \
        --restart=Never \
        --env="DATABASE_URL=$(kubectl get secret revealui-secrets -n ${NAMESPACE} -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
        -n ${NAMESPACE} \
        -- pnpm db:migrate

    # Wait for migration to complete
    kubectl wait --for=condition=complete --timeout=300s job/revealui-migrate-${VERSION} -n ${NAMESPACE} || {
        echo -e "${RED}Migration failed!${NC}"
        kubectl logs job/revealui-migrate-${VERSION} -n ${NAMESPACE}
        exit 1
    }

    echo -e "${GREEN}✓ Database migrations completed${NC}"
}

# Apply ingress
apply_ingress() {
    echo -e "\n${YELLOW}Applying ingress configuration...${NC}"

    kubectl apply -f k8s/ingress.yaml -n ${NAMESPACE}

    echo -e "${GREEN}✓ Ingress configured${NC}"
}

# Run smoke tests
run_smoke_tests() {
    echo -e "\n${YELLOW}Running smoke tests...${NC}"

    # Get service URLs
    ADMIN_URL=$(kubectl get ingress revealui-ingress -n ${NAMESPACE} -o jsonpath='{.spec.rules[0].host}')
    DASHBOARD_URL=$(kubectl get ingress revealui-ingress -n ${NAMESPACE} -o jsonpath='{.spec.rules[2].host}')

    # Test Admin health endpoint
    echo "Testing Admin: https://${ADMIN_URL}/api/health"
    if curl -f -s "https://${ADMIN_URL}/api/health" > /dev/null; then
        echo -e "${GREEN}✓ Admin health check passed${NC}"
    else
        echo -e "${RED}✗ Admin health check failed${NC}"
        exit 1
    fi

    # Test Dashboard health endpoint
    echo "Testing Dashboard: https://${DASHBOARD_URL}/api/health"
    if curl -f -s "https://${DASHBOARD_URL}/api/health" > /dev/null; then
        echo -e "${GREEN}✓ Dashboard health check passed${NC}"
    else
        echo -e "${RED}✗ Dashboard health check failed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ All smoke tests passed${NC}"
}

# Display deployment status
show_status() {
    echo -e "\n${YELLOW}Deployment Status:${NC}"
    echo "========================================="

    kubectl get pods -n ${NAMESPACE}
    echo ""
    kubectl get services -n ${NAMESPACE}
    echo ""
    kubectl get ingress -n ${NAMESPACE}

    echo -e "\n${GREEN}Deployment completed successfully!${NC}"
}

# Main deployment flow
main() {
    check_prerequisites

    if [ "${SKIP_BUILD}" != "true" ]; then
        build_images
        push_images
    fi

    apply_k8s_configs
    deploy_apps
    run_migrations
    apply_ingress

    if [ "${SKIP_TESTS}" != "true" ]; then
        run_smoke_tests
    fi

    show_status
}

# Run main function
main
