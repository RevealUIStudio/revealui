---
name: vercel-deploy
description: Deployment to Vercel including configuration, environment variables, and production best practices.
---

# Deploy to Vercel

Refer to the official documentation for comprehensive guidance:

- https://vercel.com/docs/deployments/overview
- https://vercel.com/docs/projects/environment-variables
- https://vercel.com/docs/cli

## Key Points

- Use `vercel deploy` for preview deployments and `vercel deploy --prod` for production; prefer CI-triggered deploys via GitHub Actions over manual CLI deploys
- Set environment variables per environment (Development, Preview, Production) in the Vercel dashboard or via `vercel env add`; never commit secrets to the repository
- Configure `vercel.json` or `next.config.ts` for custom headers, redirects, and rewrites; avoid duplicating routing logic between both files
- Enable Skew Protection to handle version mismatches during rolling deployments; set appropriate `maxDuration` for serverless functions based on plan limits
- Monitor deployments with `vercel logs` and the deployment detail page; use `vercel rollback` to revert to a previous known-good deployment if issues arise
