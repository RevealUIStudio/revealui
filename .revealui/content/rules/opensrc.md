# opensrc — Package Source Context

## What It Is

`opensrc` fetches full source code for npm packages into a local `opensrc/` directory. This gives agents access to actual implementations, not just types or docs.

## When to Use

- When you need to understand how a dependency works internally (not just its API)
- When types alone are insufficient (e.g., understanding Drizzle query builders, Hono middleware internals, Stripe SDK behavior)
- When debugging integration issues with a third-party package

## Usage

```bash
# Fetch a package (auto-detects version from lockfile)
opensrc zod --cwd "$REVEALFLEET_ROOT/revealui"

# Fetch specific version
opensrc stripe@17.0.0 --cwd "$REVEALFLEET_ROOT/revealui"

# Fetch multiple packages
opensrc drizzle-orm hono @neondatabase/serverless --cwd "$REVEALFLEET_ROOT/revealui"

# Fetch from GitHub repo
opensrc vercel/ai --cwd "$REVEALFLEET_ROOT/revealui"

# List fetched sources
opensrc list --cwd "$REVEALFLEET_ROOT/revealui"

# Remove a fetched package
opensrc rm zod --cwd "$REVEALFLEET_ROOT/revealui"
```

## Conventions

- Always pass `--cwd "$REVEALFLEET_ROOT/revealui"` (opensrc writes to cwd). Fleet root is the rfg bootstrap pin, never `$HOME/revealfleet` at runtime.
- The `opensrc/` directory is gitignored — fetch on demand, don't hoard
- After fetching, read files directly from `opensrc/<package>/` with the Read tool
- Clean up when done if the source is no longer needed: `opensrc rm <package>`
- Prefer fetching over guessing when you're unsure how a dependency behaves
