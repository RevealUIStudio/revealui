---
name: turborepo
description: Turborepo monorepo task orchestration, caching, and pipeline configuration guidance.
---

# Turborepo

Refer to the official documentation for comprehensive guidance:

- https://turbo.build/repo/docs
- https://turbo.build/repo/docs/crafting-your-repository/configuring-tasks
- https://turbo.build/repo/docs/crafting-your-repository/caching

## Key Points

- Define tasks in the root `turbo.json` with explicit `dependsOn` arrays to express the build graph; use `^build` to depend on upstream package builds
- Leverage remote caching (`--remote-cache`) or local `.turbo/` cache to skip unchanged tasks; never commit `.turbo/` to git
- Use `--filter` to scope runs to specific packages (e.g., `turbo run test --filter=@revealui/core`) and avoid rebuilding the entire graph
- Set `outputs` for each task so Turborepo knows what artifacts to cache and restore (e.g., `["dist/**"]` for build tasks, `[]` for lint/test)
- Use `--concurrency` to control parallelism based on available system resources; lower it on memory-constrained machines to prevent OOM
