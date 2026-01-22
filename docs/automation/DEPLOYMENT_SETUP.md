# Deployment Setup Guide

## Overview

RevealUI uses Vercel for both staging and production deployments. This document covers the setup and configuration for automated deployments.

## Environments

### Staging Environment
- **Trigger**: Automatic on pushes to `main` branch
- **Purpose**: Performance testing and validation
- **URL**: Auto-generated Vercel deployment URL (e.g., `https://revealui-xyz.vercel.app`)
- **Retention**: Deployments are temporary and may be cleaned up by Vercel

### Production Environment
- **Trigger**: Manual approval after staging validation
- **Purpose**: Live user-facing application
- **URL**: Production domain (configured in Vercel)
- **Retention**: Permanent deployments with rollback capability

## Required Secrets

Add these secrets to your GitHub repository:

### Vercel Integration
```
VERCEL_TOKEN          # Vercel API token for deployments
VERCEL_PROJECT_ID     # Optional: Project ID for advanced Vercel features
VERCEL_ORG_ID         # Optional: Organization ID for team deployments
```

### Environment Variables
```
STAGING_URL           # Base URL for staging performance tests
PRODUCTION_URL        # Production domain URL
```

## Vercel Configuration

### Project Setup
1. Connect your GitHub repository to Vercel
2. Configure build settings:
   - **Framework**: Next.js (for CMS) + Static (for Web)
   - **Build Command**: `pnpm build:packages && pnpm build`
   - **Output Directory**: Auto-detected from `vercel.json`
   - **Install Command**: `pnpm install --frozen-lockfile`

### Domain Configuration
- **Staging**: Uses Vercel's auto-generated URLs
- **Production**: Configure your custom domain in Vercel dashboard

## Deployment Workflow

### Automatic Staging Deployment
1. **Trigger**: Push to `main` branch or manual workflow dispatch
2. **Build**: Packages and applications are built
3. **Deploy**: Pushed to Vercel staging
4. **Test**: Performance tests run against staging URL
5. **Gate**: Results determine production deployment readiness

### Manual Production Deployment
1. **Trigger**: Manual workflow dispatch after staging approval
2. **Validation**: Requires staging URL input
3. **Deploy**: Production deployment to custom domain
4. **Verification**: Smoke tests and health checks
5. **Monitoring**: Deployment status and rollback plan

## Troubleshooting

### Common Issues

#### Vercel CLI Authentication
```
Error: No authorization token was found
```
**Solution**: Ensure `VERCEL_TOKEN` secret is properly set

#### Build Failures
```
Error: Build failed due to missing dependencies
```
**Solution**: Check that `pnpm install` completed successfully

#### Domain Configuration
```
Error: Domain not configured
```
**Solution**: Configure custom domain in Vercel dashboard

### Rollback Procedures

#### Emergency Rollback
1. Go to Vercel Dashboard → Your Project → Deployments
2. Find the failing deployment
3. Click "Rollback" to revert to previous version
4. Monitor application health

#### Via GitHub Actions
1. Run "Production Deployment" workflow with `force_deploy: true`
2. Select a previous working deployment
3. Monitor rollback completion

## Monitoring

### Health Checks
- **Staging**: Automatic health checks during deployment
- **Production**: Smoke tests after deployment completion

### Performance Monitoring
- **Lighthouse**: Automated performance scoring
- **Load Testing**: Response time and throughput validation
- **Regression Detection**: Performance baseline comparisons

## Security Considerations

- **Secrets Management**: All Vercel tokens stored as GitHub secrets
- **Environment Isolation**: Staging and production use separate environments
- **Access Control**: Production deployments require manual approval
- **Audit Trail**: All deployments logged in GitHub Actions and Vercel

## Cost Optimization

- **Staging Cleanup**: Vercel automatically removes old staging deployments
- **Production Optimization**: Use Vercel Analytics to monitor usage
- **Build Caching**: GitHub Actions caching reduces build times

## Support

For deployment issues:
1. Check Vercel dashboard for deployment logs
2. Review GitHub Actions workflow runs
3. Check environment variables and secrets
4. Contact DevOps team for assistance