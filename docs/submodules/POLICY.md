# No Git Submodules Policy

## Rule

**No git submodules are permitted in any RevealUI Suite repository.** This policy is permanent and applies to all repos under the `RevealUIStudio` GitHub org.

## Why

Git submodules create brittle cross-repo coupling, confuse CI, break shallow clones, and make onboarding painful. RevealUI uses two mechanisms for cross-repo dependencies:

- **Workspace references** (`workspace:*`) for packages within a monorepo
- **Published npm packages** for cross-repo consumption (e.g., revdev importing `@revealui/security`)

Both are versioned, auditable, and work with standard tooling. Submodules do not.

## CI Enforcement

The `no-submodules.yml` GitHub Actions workflow runs:

- On every push to `main` and `test`
- On every pull request targeting `main` or `test`
- Weekly (Sunday 6 AM UTC) as a drift check

It executes `scripts/audit-no-submodules.sh`, which checks four vectors:

1. **`.gitmodules` file** at repo root
2. **`.git/modules/` directory** (stale artifacts from removed submodules)
3. **`git config` submodule entries** (config-level remnants)
4. **Tree-object gitlinks** (mode 160000 entries in the git tree)

Any hit fails the workflow and blocks the PR.

## Remediation

If a submodule is ever found:

1. **Identify the dependency.** What does the submodule provide? A library, config, shared types?

2. **Convert to a published dep.** If the submodule is a separate repo:
   - Publish it as an npm package (scoped under `@revealui/` if internal)
   - Add it as a normal dependency in `package.json`
   - Remove the submodule: `git submodule deinit <path> && git rm <path> && rm -rf .git/modules/<path>`

3. **Or vendor it.** If publishing isn't practical:
   - Copy the relevant source files into the repo
   - Add a `PROVENANCE.md` noting the origin, license, and version
   - Remove the submodule link as above

4. **Never leave the submodule link in place.** Even if "unused," stale `.gitmodules` entries confuse tooling and signal intent to future contributors.

5. **Clean up git config:** `git config --remove-section submodule.<name>` if entries persist after removal.
