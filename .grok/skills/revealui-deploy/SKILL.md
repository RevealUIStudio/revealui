<!-- generated from .revealui/content/skills/revealui-deploy/SKILL.md -->
---
name: revealui-deploy
description: |
  RevealUI deployment guide for the maintained GitHub Actions workflows,
  Vault-backed credentials, deployment evidence, and failure diagnosis.
  Use when reviewing deployment configuration or investigating a failed deployment.
---

# RevealUI Deploy

## Deployment ownership

The repository's maintained workflows own deployment. Read their current
definitions before describing a trigger, app matrix, environment, or check:

- `.github/workflows/deploy.yml` owns production deployment after a push to
  `main`, including an approved promotion from `test`. It also declares a
  manual dispatch interface.
- `.github/workflows/deploy-test.yml` owns explicitly requested preview
  deployment. A push to `test` runs CI; it does not automatically deploy.
- `.github/workflows/ci.yml` owns the CI checks required for a change.

Prepare fixes through the existing feature PR, `test`, and promotion flow.
Confirm the exact revision's required checks and the user's authorization
before a promotion merge or workflow dispatch. Reading this skill does not
authorize deployment, release, credential changes, or domain changes.
Emergency fixes use the same maintained workflow and checks.

## App and environment evidence

The workflows deploy the API, admin, marketing, and docs apps. Resolve the
current app selection, project mapping, stable aliases, and smoke checks from
the workflow and its declared configuration. Report the revision and run ID
that support a deployment status. A passing build is not evidence that a
deployment or public endpoint succeeded.

## Credentials

The Vault is the source of truth. GitHub Actions secrets and hosting
environment values are downstream mirrors. Follow the repository's maintained
credential lifecycle and the shared `secrets.md` rule; inspect
`docs/runbooks/secret-rotation.md` for the owning rotation and mirror flow.
Confirm that flow's current validation and any recorded blockers before use.

- An authorized human stores provider-issued values through the Vault CLI's
  hidden terminal input. Do not ask for a value in chat or an agent tool call.
- Never paste values into shell command text, command arguments, logs, or
  plaintext temporary files. A fixed temporary filename is not a secret store.
- Use the supported Vault-to-consumer mirror interface. If its source,
  authorization, or exact-value handling is unverified, record the owning
  lifecycle blocker rather than manually setting a divergent copy.
- Choose provider-supported scope and expiration for the required consumer;
  do not default to full-account access or an unbounded token lifetime.
- Check credential availability and authentication through maintained tooling
  that reports status without printing values. Authentication failure alone
  does not establish secret corruption or authorize a rotation.

## Workflow token handling

Pass a GitHub secret through the step's environment, then expand the environment
variable as a quoted shell argument. GitHub expression substitution inside
`run` text can turn token content into shell syntax even inside double quotes.
The existing Vercel CLI workflow uses its required token argument on the
managed runner; do not copy a literal token into a local command.

```yaml
env:
  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
run: vercel pull --yes --token="$VERCEL_TOKEN"
```

Keep the workflow's existing secret masking and access controls. This example
does not claim that the token argument is invisible to the runner's processes.
Use the workflow's declared tool versions and frozen lockfile. Verify tool
pinning from its current definition; production and preview may differ.

## Failure diagnosis

1. Read the failed run's revision, selected apps, environment, and failed step.
2. Distinguish authorization, credential presence, project mapping, build,
   deployment, alias, and smoke-check failures from their actual evidence.
3. Fix the owning workflow, configuration, bootstrap, or product primitive.
   Preserve failed-run evidence and run the relevant maintained checks.
4. Prepare the normal reviewed change. Obtain any still-required authorization
   for promotion, dispatch, credential lifecycle work, or domain changes.
5. Verify the authorized run and its declared endpoint checks before reporting
   success. Do not retry a metered deployment merely to diagnose its cause.

Direct local deploy or rollback commands, manual credential copies, and
machine-specific environment overrides are not alternate recovery paths.
If the owning workflow cannot support required recovery, track the missing
behavior and its validation in that workflow's maintained work item.
