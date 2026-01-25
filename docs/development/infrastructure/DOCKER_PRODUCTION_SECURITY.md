# Docker Production Security Setup Guide

This guide covers security best practices for deploying ElectricSQL and test databases in production using Docker Compose.

## Overview

The `docker-compose.electric.yml` and `docker-compose.test.yml` files are configured for development by default. For production deployments, additional security measures must be implemented.

---

## Docker Hardened Images (DHI) - Secure by Default

### What are Docker Hardened Images?

As of **December 17, 2025**, Docker made its catalog of **1,000+ Docker Hardened Images (DHI)** free and open source under the Apache 2.0 license. These images provide:

- **Minimal attack surface**: Up to 95% smaller than typical community images
- **Non-root execution** by default
- **Continuous vulnerability scanning** with public CVE reporting
- **Full SBOM** (Software Bill of Materials)
- **SLSA Build Level 3 provenance** and signed attestations
- **Transparent security**: All CVEs are publicly reported

### Why Use DHI?

**Benefits**:
- **Free and open source** - No cost for core hardened images
- **Production-ready** - Minimal, secure images optimized for containers
- **Transparent** - Full visibility into security posture and vulnerabilities
- **Compliance-ready** - Includes SBOM, provenance, and attestations

**Resources**:
- Official website: https://dhi.io
- Documentation: https://docs.docker.com/dhi/
- GitHub: https://github.com/docker-hardened-images

### Current DHI Availability for RevealUI

| Service | DHI Available? | Current Image | DHI Alternative | Notes |
|---------|---------------|---------------|-----------------|-------|
| **PostgreSQL** | ✅ Yes | `pgvector/pgvector:pg16` | `dhi.io/postgres:17-debian13` | DHI postgres available, but pgvector not yet included |
| **PostgreSQL + pgvector** | ❌ Not yet | `pgvector/pgvector:pg16` | N/A | Monitor DHI catalog for future support |
| **ElectricSQL** | ❌ Not yet | `electricsql/electric:latest` | N/A | Consider custom DHI-based build |

### Using DHI Images

#### Option 1: Use DHI PostgreSQL (when pgvector not required)

```yaml
services:
  postgres:
    image: dhi.io/postgres:17-debian13  # Debian-based, hardened
    # Or use Alpine for smaller size:
    # image: dhi.io/postgres:17-alpine3.22
```

#### Option 2: Build Custom DHI-Based Image with pgvector

Since DHI doesn't yet support PostgreSQL + pgvector, you can build a custom hardened image:

```dockerfile
# Dockerfile.example-hardened-pgvector
FROM dhi.io/postgres:17-debian13

# Install pgvector extension
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    postgresql-17-pgvector && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Ensure non-root execution (DHI already does this)
USER postgres
```

#### Option 3: Monitor for Official DHI Support

- Watch Docker DHI announcements for PostgreSQL + pgvector support
- Monitor ElectricSQL releases for DHI compatibility
- Consider contributing to DHI community requests for these images

### DHI Free vs Enterprise

**Free Tier (Available Now)**:
- ✅ All hardened images (1,000+ images)
- ✅ Continuous vulnerability scanning
- ✅ SBOM and provenance
- ✅ Public CVE reporting
- ✅ Non-root execution

**Enterprise Tier (Paid)**:
- ⚡ SLA-backed security updates (critical CVEs in ≤7 days)
- 🔒 Compliance variants (FIPS, STIG, FedRAMP)
- 🛠️ Custom image builds and customization
- 📅 Extended Lifecycle Support (post-EOL maintenance)

### Migration Recommendations

1. **Immediate**: Review DHI catalog for available alternatives to current images
2. **Short-term**: Use DHI base images where available (e.g., for services not requiring pgvector)
3. **Long-term**: Build custom DHI-based images for services requiring extensions (pgvector)
4. **Monitoring**: Watch for official DHI support for PostgreSQL + pgvector and ElectricSQL

### Docker Scout Integration

Docker Scout provides vulnerability scanning for images. In the **free tier**:
- **1 Scout-enabled repository** (private or public)
- Unlimited public repositories
- Continuous vulnerability analysis
- CVE visibility and reporting

**Enable Scout**:
```bash
# Enable Scout for a repository
docker scout repo enable <repo-name>

# View vulnerabilities
docker scout cves <image-name>
```

---

## ElectricSQL Production Security

### Critical Security Requirements

#### 1. Disable Insecure Mode

**Development (Current)**:
```yaml
environment:
  - ELECTRIC_INSECURE=true  # ⚠️ NEVER use in production
```

**Production**:
```yaml
environment:
  - ELECTRIC_INSECURE=false  # Or omit entirely
  - ELECTRIC_SECRET=${ELECTRIC_SECRET}  # Required for production
```

#### 2. Set Strong ELECTRIC_SECRET

Generate a secure secret:

```bash
# Generate a strong random secret (32+ characters)
openssl rand -hex 32

# Or use the project's secret generator
pnpm generate:secret
```

Set in your production environment:

```bash
export ELECTRIC_SECRET="your-generated-secret-here-minimum-32-characters"
```

**⚠️ Never commit secrets to git or expose them in logs**

#### 3. JWT Authentication (Recommended)

For production, configure JWT authentication:

```yaml
environment:
  - AUTH_MODE=jwt  # Use JWT instead of insecure
  - AUTH_JWT_ALG=HS256  # Algorithm (HS256, RS256, etc.)
  - AUTH_JWT_KEY=${AUTH_JWT_KEY}  # JWT secret key
  - AUTH_JWT_NAMESPACE=${AUTH_JWT_NAMESPACE:-}  # Optional namespace
```

**JWT Configuration**:
- Generate JWT key: `openssl rand -hex 32`
- Use HS256 for symmetric keys (simpler)
- Use RS256 for asymmetric keys (more secure, requires public/private key pair)
- Set `AUTH_JWT_NAMESPACE` if using namespaced JWT claims

#### 4. Database Connection Security

**Secure Database URL**:
- Use SSL-enabled database connections in production
- Never expose database credentials in compose files
- Use environment variables or secrets management:

```yaml
environment:
  - DATABASE_URL=${POSTGRES_URL}  # Load from secure secrets manager
```

**Recommended Format**:
```
postgresql://user:password@host:port/database?sslmode=require
```

#### 5. Network Security

**Production Network Configuration**:

```yaml
networks:
  revealui-network:
    driver: bridge
    # Consider using overlay network for multi-host deployments
    # driver: overlay
    # attachable: true
```

**Firewall Rules**:
- Only expose necessary ports (5133 for service, 65432 for proxy)
- Use reverse proxy (nginx, Traefik) instead of direct port exposure
- Implement rate limiting and DDoS protection

#### 6. Resource Limits

The compose file includes resource limits. Adjust for your production needs:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'      # Adjust based on load
      memory: 2G     # Adjust based on data volume
    reservations:
      cpus: '0.5'
      memory: 512M
```

#### 7. Logging and Monitoring

**Production Logging**:
- Logs are configured with rotation (10MB max, 3 files)
- Forward logs to centralized logging system (e.g., ELK, Datadog)
- Never log sensitive information (secrets, passwords, tokens)

**Monitor**:
- Service health via `/health` endpoint
- Resource usage (CPU, memory, disk)
- Connection pool status
- Replication lag

---

## Test Database Security (docker-compose.test.yml)

### Security Considerations

#### 1. Never Use in Production

**⚠️ CRITICAL**: The test database configuration uses insecure credentials:

```yaml
environment:
  POSTGRES_USER: test
  POSTGRES_PASSWORD: test  # ⚠️ Insecure - OK for testing only
```

**This configuration is ONLY for local development and CI/CD testing.**

#### 2. Test Environment Isolation

- Test database runs on port `5433` to avoid conflicts
- Uses isolated network (`test-network`)
- Data is ephemeral (consider using volumes in CI/CD)

#### 3. CI/CD Usage

For CI/CD environments:

```yaml
# Override with secure credentials if needed
environment:
  POSTGRES_USER: ${CI_POSTGRES_USER:-test}
  POSTGRES_PASSWORD: ${CI_POSTGRES_PASSWORD:-test}
  POSTGRES_DB: ${CI_POSTGRES_DB:-test_revealui}
```

**Best Practice**: Use randomly generated credentials in CI/CD:

```bash
export TEST_POSTGRES_USER=$(openssl rand -hex 8)
export TEST_POSTGRES_PASSWORD=$(openssl rand -hex 16)
export TEST_POSTGRES_DB="test_$(openssl rand -hex 4)"
```

---

## Production Deployment Checklist

### Pre-Deployment

- [ ] `ELECTRIC_INSECURE` is set to `false` or omitted
- [ ] `ELECTRIC_SECRET` is set with strong random value (32+ characters)
- [ ] JWT authentication is configured (if using)
- [ ] Database URL uses SSL (`sslmode=require`)
- [ ] All secrets are stored in secure secrets manager (not in files)
- [ ] Resource limits are appropriate for expected load
- [ ] Network firewall rules are configured
- [ ] Health checks are working
- [ ] Logging is configured and monitored
- [ ] Backup strategy is in place

### Deployment

- [ ] Use secrets management (Docker secrets, Kubernetes secrets, AWS Secrets Manager, etc.)
- [ ] Deploy behind reverse proxy with TLS termination
- [ ] Enable rate limiting
- [ ] Configure monitoring and alerting
- [ ] Test health checks and failover scenarios

### Post-Deployment

- [ ] Verify service is accessible via health endpoint
- [ ] Monitor logs for errors or warnings
- [ ] Verify resource usage is within limits
- [ ] Test authentication/authorization
- [ ] Verify database connection and replication
- [ ] Test failover and recovery procedures

---

## Environment Variable Reference

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `ELECTRIC_SECRET` | Secret for ElectricSQL authentication | Generated 32+ char secret |
| `DATABASE_URL` or `POSTGRES_URL` | PostgreSQL connection string with SSL | `postgresql://user:pass@host/db?sslmode=require` |

### Optional for Production

| Variable | Description | Default | Production Recommendation |
|----------|-------------|---------|---------------------------|
| `ELECTRIC_INSECURE` | Disable security (dev only) | `true` | Set to `false` or omit |
| `AUTH_MODE` | Authentication mode | `insecure` | Set to `jwt` |
| `AUTH_JWT_ALG` | JWT algorithm | - | `HS256` or `RS256` |
| `AUTH_JWT_KEY` | JWT secret key | - | Generate strong secret |
| `ELECTRIC_LOG_LEVEL` | Logging level | `info` | `info` or `warn` |
| `ELECTRIC_WRITE_TO_PG_MODE` | Write mode | `direct_writes` | Configure based on needs |

---

## Secrets Management

### Docker Secrets (Docker Swarm)

```yaml
services:
  electric-sql:
    secrets:
      - electric_secret
      - database_url
    environment:
      - ELECTRIC_SECRET_FILE=/run/secrets/electric_secret
      - DATABASE_URL_FILE=/run/secrets/database_url

secrets:
  electric_secret:
    external: true
  database_url:
    external: true
```

### Environment Files (Not Recommended for Production)

For local development only:

```bash
# .env.electric (DO NOT COMMIT)
ELECTRIC_SECRET=your-secret-here
DATABASE_URL=postgresql://...
```

**⚠️ Never commit `.env` files with production secrets to git**

### Recommended: External Secrets Manager

- **AWS**: AWS Secrets Manager, AWS Parameter Store
- **Azure**: Azure Key Vault
- **GCP**: Google Secret Manager
- **HashiCorp**: Vault
- **Kubernetes**: Kubernetes Secrets (encrypted at rest)

---

## Reverse Proxy Configuration

### Example: Nginx

```nginx
upstream electric_sql {
    server localhost:5133;
}

server {
    listen 443 ssl http2;
    server_name electric.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://electric_sql;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }

    # Health check endpoint (internal only)
    location /health {
        allow 127.0.0.1;
        deny all;
        proxy_pass http://electric_sql/health;
    }
}
```

---

## Monitoring and Alerting

### Health Check

```bash
# Check service health
curl -f http://localhost:5133/health

# Or use Docker health check
docker compose -f docker-compose.electric.yml ps
```

### Metrics to Monitor

- **Service Uptime**: Container restart count
- **Resource Usage**: CPU, memory, disk I/O
- **Connection Pool**: Active connections, pool size
- **Replication Lag**: Sync delays
- **Error Rate**: Failed requests, connection errors
- **Response Time**: API latency

### Alerting Rules

- Container restarts > 3 in 5 minutes
- CPU usage > 80% for 5 minutes
- Memory usage > 90%
- Health check failures > 3 consecutive
- Error rate > 5% for 5 minutes

---

## Troubleshooting

### Service Won't Start

1. Check logs: `docker compose -f docker-compose.electric.yml logs -f`
2. Verify `DATABASE_URL` is correct and accessible
3. Verify `ELECTRIC_SECRET` is set (if `ELECTRIC_INSECURE=false`)
4. Check resource limits aren't too restrictive
5. Verify ports aren't already in use

### Authentication Failures

1. Verify `ELECTRIC_SECRET` matches between client and server
2. Check JWT configuration if using JWT auth
3. Verify `ELECTRIC_INSECURE` is not `true` in production
4. Check logs for authentication errors

### Connection Issues

1. Verify database is accessible from container
2. Check network configuration
3. Verify SSL certificates if using SSL
4. Check firewall rules

---

## Related Documentation

- [ElectricSQL Integration Guide](./electric-integration.md) - General integration guide
- [ElectricSQL Setup Guide](./electric-setup-guide.md) - Setup instructions
- [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md) - Environment configuration
- [Docker Compose Assessment](../assessments/DOCKER_COMPOSE_ASSESSMENT_2026.md) - Configuration assessment
- [Deployment Runbook](../guides/deployment/DEPLOYMENT-RUNBOOK.md) - Deployment procedures
- [Docker Hardened Images](https://docs.docker.com/dhi/) - Official DHI documentation
- [DHI Catalog](https://dhi.io) - Browse available hardened images

---

## Security Best Practices Summary

1. ✅ **Use Docker Hardened Images (DHI)** where available - secure by default, free, and production-ready
2. ✅ **Always disable `ELECTRIC_INSECURE` in production**
3. ✅ **Use strong, randomly generated secrets** (32+ characters)
4. ✅ **Store secrets in secure secrets manager**, never in files
5. ✅ **Use SSL/TLS for all database connections**
6. ✅ **Deploy behind reverse proxy with TLS termination**
7. ✅ **Enable resource limits** to prevent resource exhaustion
8. ✅ **Monitor and log** all service activity
9. ✅ **Enable Docker Scout** for vulnerability scanning (1 repo free)
10. ✅ **Regular security audits** and updates
11. ✅ **Use JWT authentication** for production deployments
12. ✅ **Never commit secrets** to version control
13. ✅ **Review SBOM and provenance** from DHI images for compliance

---

**Last Updated**: January 2026  
**Review Frequency**: Quarterly or after security incidents
