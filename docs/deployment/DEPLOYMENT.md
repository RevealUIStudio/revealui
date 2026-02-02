# RevealUI Deployment Guide

Comprehensive guide for deploying RevealUI to production and staging environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring](#monitoring)
- [Disaster Recovery](#disaster-recovery)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- **Docker** (v24+): Container runtime
- **kubectl** (v1.28+): Kubernetes CLI
- **Node.js** (v20+): For local development
- **pnpm** (v8+): Package manager
- **helm** (v3+): Kubernetes package manager (optional)

### Required Access

- Kubernetes cluster (GKE, EKS, AKS, or self-hosted)
- Container registry (Docker Hub, GCR, ECR, or ACR)
- GitHub repository access (for CI/CD)
- Domain name with DNS control

### Infrastructure Requirements

**Minimum Resources:**
- 4 CPU cores
- 8GB RAM
- 100GB storage

**Production Resources:**
- 16+ CPU cores
- 32GB+ RAM
- 500GB+ storage
- Load balancer
- SSL certificates

## Local Development

### Using Docker Compose

The easiest way to run RevealUI locally is with Docker Compose:

```bash
# Clone repository
git clone https://github.com/your-org/revealui.git
cd revealui

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Services Available:**
- **CMS**: http://localhost:3000
- **Dashboard**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **MinIO**: http://localhost:9000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3003

### Using pnpm (Native)

For faster development iteration:

```bash
# Install dependencies
pnpm install

# Set up database
pnpm db:push
pnpm db:seed

# Start development servers
pnpm dev

# CMS: http://localhost:3000
# Dashboard: http://localhost:3001
```

## Docker Deployment

### Building Images

Build production Docker images:

```bash
# Build base image
docker build -f docker/Dockerfile.base -t revealui/base:latest .

# Build CMS
docker build -f docker/Dockerfile.cms -t revealui/cms:v1.0.0 .

# Build Dashboard
docker build -f docker/Dockerfile.dashboard -t revealui/dashboard:v1.0.0 .
```

### Multi-Architecture Builds

Build for multiple platforms:

```bash
# Set up buildx
docker buildx create --use

# Build and push multi-arch images
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/Dockerfile.cms \
  -t revealui/cms:v1.0.0 \
  --push .
```

### Pushing to Registry

```bash
# Login to registry
docker login

# Tag images
docker tag revealui/cms:v1.0.0 registry.example.com/revealui/cms:v1.0.0

# Push images
docker push registry.example.com/revealui/cms:v1.0.0
docker push registry.example.com/revealui/dashboard:v1.0.0
```

## Kubernetes Deployment

### Cluster Setup

#### Google Kubernetes Engine (GKE)

```bash
# Create cluster
gcloud container clusters create revealui \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-4 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10

# Get credentials
gcloud container clusters get-credentials revealui --zone us-central1-a
```

#### Amazon EKS

```bash
# Create cluster
eksctl create cluster \
  --name revealui \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.xlarge \
  --nodes 3 \
  --nodes-min 3 \
  --nodes-max 10

# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name revealui
```

#### Azure AKS

```bash
# Create cluster
az aks create \
  --resource-group revealui-rg \
  --name revealui \
  --node-count 3 \
  --node-vm-size Standard_D4s_v3 \
  --enable-cluster-autoscaler \
  --min-count 3 \
  --max-count 10

# Get credentials
az aks get-credentials --resource-group revealui-rg --name revealui
```

### Installing cert-manager

For automatic SSL certificate management:

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Verify installation
kubectl get pods -n cert-manager
```

### Installing NGINX Ingress Controller

```bash
# Install NGINX Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.0/deploy/static/provider/cloud/deploy.yaml

# Get external IP
kubectl get service ingress-nginx-controller -n ingress-nginx
```

### Deploying RevealUI

#### 1. Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

#### 2. Configure Secrets

Edit `k8s/secrets.yaml` with your actual secrets (or use a secrets manager):

```bash
# Generate base64 encoded secrets
echo -n "your-database-password" | base64
echo -n "your-jwt-secret" | base64

# Apply secrets
kubectl apply -f k8s/secrets.yaml
```

**Production Best Practice:** Use external secrets management:

```bash
# Using Google Secret Manager
kubectl create secret generic revealui-secrets \
  --from-literal=DATABASE_URL="$(gcloud secrets versions access latest --secret=database-url)" \
  --namespace=revealui

# Using AWS Secrets Manager
kubectl create secret generic revealui-secrets \
  --from-literal=DATABASE_URL="$(aws secretsmanager get-secret-value --secret-id database-url --query SecretString --output text)" \
  --namespace=revealui
```

#### 3. Deploy StatefulSets (Databases)

```bash
# Deploy PostgreSQL
kubectl apply -f k8s/statefulsets/postgres.yaml

# Deploy Redis
kubectl apply -f k8s/statefulsets/redis.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n revealui --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n revealui --timeout=300s
```

#### 4. Deploy Applications

```bash
# Deploy CMS
kubectl apply -f k8s/deployments/cms.yaml

# Deploy Dashboard
kubectl apply -f k8s/deployments/dashboard.yaml

# Wait for deployments
kubectl rollout status deployment/revealui-cms -n revealui
kubectl rollout status deployment/revealui-dashboard -n revealui
```

#### 5. Configure Ingress

Update `k8s/ingress.yaml` with your domain:

```yaml
spec:
  rules:
    - host: revealui.example.com  # Your domain
    - host: api.revealui.example.com
    - host: dashboard.revealui.example.com
```

Apply ingress:

```bash
kubectl apply -f k8s/ingress.yaml
```

#### 6. Configure DNS

Point your domains to the ingress controller's external IP:

```bash
# Get external IP
kubectl get ingress revealui-ingress -n revealui

# Add DNS A records:
# revealui.example.com        -> EXTERNAL_IP
# api.revealui.example.com    -> EXTERNAL_IP
# dashboard.revealui.example.com -> EXTERNAL_IP
```

### Using Deployment Script

Automated deployment:

```bash
# Deploy to production
ENVIRONMENT=production VERSION=v1.0.0 ./scripts/deploy.sh

# Deploy to staging
ENVIRONMENT=staging VERSION=v1.0.0-rc.1 ./scripts/deploy.sh

# Skip tests
SKIP_TESTS=true ./scripts/deploy.sh

# Skip build (use existing images)
SKIP_BUILD=true VERSION=v1.0.0 ./scripts/deploy.sh
```

## CI/CD Pipeline

### GitHub Actions Workflows

The project includes automated CI/CD workflows:

#### Continuous Integration (.github/workflows/ci.yml)

Runs on every push and pull request:

- Linting (ESLint, Biome)
- Type checking (TypeScript)
- Unit tests (Vitest)
- Integration tests
- E2E tests (Playwright)
- Security scanning (Trivy)
- Docker image builds

#### Deployment (.github/workflows/deploy.yml)

**Staging Deployment:**
- Triggered on push to `main` branch
- Builds and pushes Docker images
- Deploys to staging namespace
- Runs smoke tests

**Production Deployment:**
- Manual trigger via workflow_dispatch
- Blue-green deployment strategy
- Database migrations
- Health checks
- Automatic rollback on failure

### Setting Up GitHub Actions

1. **Configure Repository Secrets:**

Go to Settings > Secrets and variables > Actions, add:

```
KUBE_CONFIG          - Base64 encoded kubeconfig
DOCKER_USERNAME      - Container registry username
DOCKER_PASSWORD      - Container registry password
SLACK_WEBHOOK_URL    - Slack notification webhook (optional)
```

2. **Generate Kubeconfig:**

```bash
# Get kubeconfig and encode
kubectl config view --flatten --minify | base64 -w 0
```

3. **Trigger Deployment:**

```bash
# Push to main (staging)
git push origin main

# Production deployment
gh workflow run deploy.yml \
  -f environment=production \
  -f version=v1.0.0
```

## Monitoring

### Prometheus + Grafana

Deploy monitoring stack:

```bash
# Deploy Prometheus
kubectl apply -f k8s/monitoring/prometheus.yaml

# Deploy Grafana
kubectl apply -f k8s/monitoring/grafana.yaml

# Access Grafana
kubectl port-forward -n revealui svc/grafana 3000:3000
# Open http://localhost:3000
# Default credentials: admin / admin
```

### Pre-configured Dashboards

Import dashboards from `k8s/monitoring/dashboards/`:

1. **RevealUI Overview**: System health, request rates, errors
2. **Database Metrics**: PostgreSQL connections, query performance
3. **Redis Metrics**: Memory usage, hit rate, commands
4. **Kubernetes Metrics**: Pod CPU/memory, network I/O

### Alerts

Configure alerts in `k8s/monitoring/alerts/`:

- High error rate (>5%)
- High response time (>2s p95)
- Database connection pool exhausted
- Redis memory usage >90%
- Pod crash loop
- Deployment failed

Alerts are sent to:
- Slack (if webhook configured)
- Email (if SMTP configured)
- PagerDuty (if configured)

## Disaster Recovery

### Database Backups

#### Automated Backups

PostgreSQL backups run daily at 2 AM (configured in `k8s/statefulsets/postgres.yaml`):

```bash
# View backup CronJob
kubectl get cronjob postgres-backup -n revealui

# View backup history
kubectl get jobs -n revealui | grep postgres-backup

# List backup files
kubectl exec -n revealui postgres-0 -- ls -lh /backup
```

#### Manual Backup

```bash
# Create immediate backup
kubectl create job postgres-backup-manual \
  --from=cronjob/postgres-backup \
  -n revealui

# Download backup
kubectl exec -n revealui postgres-0 -- \
  cat /backup/postgres-20240101-120000.sql.gz > backup.sql.gz
```

#### Restore from Backup

```bash
# Upload backup to pod
kubectl cp backup.sql.gz revealui/postgres-0:/tmp/

# Restore database
kubectl exec -n revealui postgres-0 -- bash -c \
  "gunzip -c /tmp/backup.sql.gz | psql -U postgres revealui"
```

### Rollback Deployments

Use the rollback script:

```bash
# View deployment history
./scripts/rollback.sh history

# Rollback to previous version
./scripts/rollback.sh rollback-all

# Rollback to specific revision
./scripts/rollback.sh rollback-cms 5

# Rollback database migration
./scripts/rollback.sh rollback-db
```

### Emergency Procedures

#### Scale Down (Maintenance Mode)

```bash
# Pause all deployments
./scripts/rollback.sh pause

# Or manually
kubectl scale deployment/revealui-cms --replicas=0 -n revealui
kubectl scale deployment/revealui-dashboard --replicas=0 -n revealui
```

#### Scale Up (Resume Operations)

```bash
# Resume deployments
./scripts/rollback.sh resume

# Or manually
kubectl scale deployment/revealui-cms --replicas=3 -n revealui
kubectl scale deployment/revealui-dashboard --replicas=2 -n revealui
```

#### Complete Disaster Recovery

```bash
# 1. Restore from backup
kubectl apply -f k8s/statefulsets/postgres.yaml
kubectl exec -n revealui postgres-0 -- restore-from-backup.sh

# 2. Redeploy applications
kubectl apply -f k8s/deployments/

# 3. Verify health
kubectl get pods -n revealui
./scripts/rollback.sh health
```

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n revealui

# View pod events
kubectl describe pod <pod-name> -n revealui

# Check logs
kubectl logs <pod-name> -n revealui

# Check previous logs (if pod restarted)
kubectl logs <pod-name> -n revealui --previous
```

#### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -n revealui postgres-0 -- pg_isready

# Check database logs
kubectl logs -n revealui postgres-0

# Verify secrets
kubectl get secret revealui-secrets -n revealui -o jsonpath='{.data.DATABASE_URL}' | base64 -d
```

#### Ingress Not Working

```bash
# Check ingress status
kubectl get ingress -n revealui

# Describe ingress
kubectl describe ingress revealui-ingress -n revealui

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Verify cert-manager
kubectl get certificate -n revealui
kubectl describe certificate revealui-tls -n revealui
```

#### High Memory Usage

```bash
# Check pod resource usage
kubectl top pods -n revealui

# Increase resource limits
kubectl set resources deployment/revealui-cms \
  --limits=memory=2Gi \
  -n revealui
```

#### Slow Response Times

```bash
# Check HPA status
kubectl get hpa -n revealui

# Manually scale up
kubectl scale deployment/revealui-cms --replicas=10 -n revealui

# Check database performance
kubectl exec -n revealui postgres-0 -- psql -U postgres revealui -c \
  "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

### Debugging Commands

```bash
# Get all resources in namespace
kubectl get all -n revealui

# Check pod resource usage
kubectl top pods -n revealui
kubectl top nodes

# View cluster events
kubectl get events -n revealui --sort-by='.lastTimestamp'

# Execute shell in pod
kubectl exec -it <pod-name> -n revealui -- /bin/sh

# Port forward to pod
kubectl port-forward -n revealui pod/<pod-name> 3000:3000

# View deployment status
kubectl rollout status deployment/revealui-cms -n revealui
kubectl rollout history deployment/revealui-cms -n revealui

# Check configuration
kubectl get configmap revealui-config -n revealui -o yaml
kubectl get secret revealui-secrets -n revealui -o yaml
```

### Performance Tuning

#### Application Level

```yaml
# Increase replicas
spec:
  replicas: 10

# Adjust HPA
spec:
  minReplicas: 5
  maxReplicas: 20
  targetCPUUtilizationPercentage: 60
```

#### Database Level

```bash
# Increase connection pool
kubectl set env deployment/revealui-cms \
  DATABASE_POOL_SIZE=50 \
  -n revealui

# Add read replicas
kubectl scale statefulset/postgres --replicas=3 -n revealui
```

#### Redis Level

```yaml
# Increase memory limit
resources:
  limits:
    memory: "2Gi"

# Enable cluster mode
spec:
  replicas: 6
```

## Security Best Practices

1. **Secrets Management**
   - Use external secrets manager (Vault, Google Secret Manager, AWS Secrets Manager)
   - Rotate secrets regularly
   - Never commit secrets to git

2. **Network Policies**
   - Implement network policies to restrict pod-to-pod communication
   - Use service mesh (Istio, Linkerd) for mTLS

3. **Image Security**
   - Scan images for vulnerabilities (Trivy, Snyk)
   - Use minimal base images (Alpine)
   - Run as non-root user
   - Keep images updated

4. **RBAC**
   - Follow principle of least privilege
   - Use service accounts with minimal permissions
   - Audit access regularly

5. **Monitoring & Logging**
   - Enable audit logging
   - Monitor for suspicious activity
   - Set up alerts for security events

## Support

For issues and questions:

- **Documentation**: https://docs.revealui.example.com
- **GitHub Issues**: https://github.com/your-org/revealui/issues
- **Slack**: #revealui-support
- **Email**: support@revealui.example.com
