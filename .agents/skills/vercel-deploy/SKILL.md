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

- For RevealUI, use the repository's maintained deployment workflows: `deploy.yml` for production and `deploy-test.yml` for explicitly requested previews. A push to `test` runs CI without deployment. Confirm exact-revision checks and user authorization before promotion or dispatch; this skill does not authorize either action.
- Keep the Vault as the credential source of truth and use the maintained downstream mirror flow. Do not put secret values in command text, logs, agent messages, or plaintext temporary files, or manually create a divergent environment copy.
- Configure `vercel.json` or `next.config.ts` for custom headers, redirects, and rewrites; avoid duplicating routing logic between both files
- Enable Skew Protection to handle version mismatches during rolling deployments; set appropriate `maxDuration` for serverless functions based on plan limits
- Review the workflow run and deployment evidence. Resolve failures and recovery in the existing workflow and normal review path; direct local deployment and rollback commands are not an emergency alternative. Do not run deployment, rollback, credential, or domain operations without explicit authorization.
