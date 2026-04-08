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

echo -e "${GREEN}RevealUI Rollback Script${NC}"
echo "========================================="
echo "Environment: $ENVIRONMENT"
echo "Namespace: $NAMESPACE"
echo "========================================="

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"

    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}Error: kubectl is not installed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

# Get deployment history
show_deployment_history() {
    echo -e "\n${YELLOW}Deployment History:${NC}"
    echo "========================================="

    echo -e "\n${YELLOW}Admin Deployment History:${NC}"
    kubectl rollout history deployment/revealui-admin -n ${NAMESPACE}

    echo -e "\n${YELLOW}Dashboard Deployment History:${NC}"
    kubectl rollout history deployment/revealui-dashboard -n ${NAMESPACE}

    echo "========================================="
}

# Rollback Admin deployment
rollback_admin() {
    local REVISION=$1
    echo -e "\n${YELLOW}Rolling back Admin deployment...${NC}"

    if [ -z "$REVISION" ]; then
        # Rollback to previous revision
        kubectl rollout undo deployment/revealui-admin -n ${NAMESPACE}
    else
        # Rollback to specific revision
        kubectl rollout undo deployment/revealui-admin --to-revision=${REVISION} -n ${NAMESPACE}
    fi

    echo "Waiting for Admin rollback to complete..."
    kubectl rollout status deployment/revealui-admin -n ${NAMESPACE} --timeout=300s

    echo -e "${GREEN}✓ Admin rolled back successfully${NC}"
}

# Rollback Dashboard deployment
rollback_dashboard() {
    local REVISION=$1
    echo -e "\n${YELLOW}Rolling back Dashboard deployment...${NC}"

    if [ -z "$REVISION" ]; then
        # Rollback to previous revision
        kubectl rollout undo deployment/revealui-dashboard -n ${NAMESPACE}
    else
        # Rollback to specific revision
        kubectl rollout undo deployment/revealui-dashboard --to-revision=${REVISION} -n ${NAMESPACE}
    fi

    echo "Waiting for Dashboard rollback to complete..."
    kubectl rollout status deployment/revealui-dashboard -n ${NAMESPACE} --timeout=300s

    echo -e "${GREEN}✓ Dashboard rolled back successfully${NC}"
}

# Rollback database migration
rollback_migration() {
    echo -e "\n${YELLOW}Rolling back database migration...${NC}"
    echo -e "${RED}WARNING: This will roll back the last migration${NC}"

    read -p "Are you sure you want to rollback the database? (yes/no): " -r
    if [[ ! $REPLY =~ ^yes$ ]]; then
        echo "Database rollback cancelled"
        return
    fi

    # Get current Admin pod
    ADMIN_POD=$(kubectl get pods -n ${NAMESPACE} -l app=revealui-admin -o jsonpath='{.items[0].metadata.name}')

    if [ -z "$ADMIN_POD" ]; then
        echo -e "${RED}Error: No Admin pod found${NC}"
        exit 1
    fi

    echo "Rolling back migration in pod: $ADMIN_POD"
    kubectl exec -n ${NAMESPACE} $ADMIN_POD -- pnpm db:migrate:down

    echo -e "${GREEN}✓ Database migration rolled back${NC}"
}

# Run health checks
run_health_checks() {
    echo -e "\n${YELLOW}Running health checks...${NC}"

    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app=revealui-admin -n ${NAMESPACE} --timeout=60s || true
    kubectl wait --for=condition=ready pod -l app=revealui-dashboard -n ${NAMESPACE} --timeout=60s || true

    # Get service URLs
    ADMIN_URL=$(kubectl get ingress revealui-ingress -n ${NAMESPACE} -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || echo "")
    DASHBOARD_URL=$(kubectl get ingress revealui-ingress -n ${NAMESPACE} -o jsonpath='{.spec.rules[2].host}' 2>/dev/null || echo "")

    if [ ! -z "$ADMIN_URL" ]; then
        echo "Testing Admin: https://${ADMIN_URL}/api/health"
        if curl -f -s "https://${ADMIN_URL}/api/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Admin health check passed${NC}"
        else
            echo -e "${RED}✗ Admin health check failed${NC}"
        fi
    fi

    if [ ! -z "$DASHBOARD_URL" ]; then
        echo "Testing Dashboard: https://${DASHBOARD_URL}/api/health"
        if curl -f -s "https://${DASHBOARD_URL}/api/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Dashboard health check passed${NC}"
        else
            echo -e "${RED}✗ Dashboard health check failed${NC}"
        fi
    fi
}

# Display current status
show_status() {
    echo -e "\n${YELLOW}Current Status:${NC}"
    echo "========================================="

    kubectl get pods -n ${NAMESPACE}
    echo ""
    kubectl get deployments -n ${NAMESPACE}

    echo -e "\n${GREEN}Rollback completed!${NC}"
}

# Pause deployment (scale to 0)
pause_deployment() {
    echo -e "\n${YELLOW}Pausing deployments...${NC}"

    kubectl scale deployment/revealui-admin --replicas=0 -n ${NAMESPACE}
    kubectl scale deployment/revealui-dashboard --replicas=0 -n ${NAMESPACE}

    echo -e "${GREEN}✓ Deployments paused (scaled to 0)${NC}"
}

# Resume deployment (scale to default)
resume_deployment() {
    echo -e "\n${YELLOW}Resuming deployments...${NC}"

    kubectl scale deployment/revealui-admin --replicas=3 -n ${NAMESPACE}
    kubectl scale deployment/revealui-dashboard --replicas=2 -n ${NAMESPACE}

    echo "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=revealui-admin -n ${NAMESPACE} --timeout=300s
    kubectl wait --for=condition=ready pod -l app=revealui-dashboard -n ${NAMESPACE} --timeout=300s

    echo -e "${GREEN}✓ Deployments resumed${NC}"
}

# Show help
show_help() {
    cat << EOF
RevealUI Rollback Script

Usage: ./rollback.sh [COMMAND] [OPTIONS]

Commands:
    history                    Show deployment history
    rollback-admin [REVISION]  Rollback Admin to previous or specific revision
    rollback-dashboard [REV]   Rollback Dashboard to previous or specific revision
    rollback-all [REVISION]    Rollback both Admin and Dashboard
    rollback-db                Rollback last database migration
    pause                      Pause deployments (scale to 0)
    resume                     Resume deployments (scale to default)
    health                     Run health checks
    status                     Show current status
    help                       Show this help message

Environment Variables:
    NAMESPACE                  Kubernetes namespace (default: revealui)
    ENVIRONMENT                Environment name (default: production)

Examples:
    # Show deployment history
    ./rollback.sh history

    # Rollback Admin to previous revision
    ./rollback.sh rollback-admin

    # Rollback Admin to specific revision
    ./rollback.sh rollback-admin 5

    # Rollback both services
    ./rollback.sh rollback-all

    # Rollback database migration
    ./rollback.sh rollback-db

    # Pause all deployments
    ./rollback.sh pause

    # Resume deployments
    ./rollback.sh resume
EOF
}

# Main execution
main() {
    check_prerequisites

    COMMAND=${1:-"help"}
    REVISION=$2

    case $COMMAND in
        history)
            show_deployment_history
            ;;
        rollback-admin)
            rollback_admin "$REVISION"
            run_health_checks
            show_status
            ;;
        rollback-dashboard)
            rollback_dashboard "$REVISION"
            run_health_checks
            show_status
            ;;
        rollback-all)
            rollback_admin "$REVISION"
            rollback_dashboard "$REVISION"
            run_health_checks
            show_status
            ;;
        rollback-db)
            rollback_migration
            ;;
        pause)
            pause_deployment
            show_status
            ;;
        resume)
            resume_deployment
            show_status
            ;;
        health)
            run_health_checks
            ;;
        status)
            show_status
            ;;
        help|*)
            show_help
            ;;
    esac
}

# Run main function
main "$@"
