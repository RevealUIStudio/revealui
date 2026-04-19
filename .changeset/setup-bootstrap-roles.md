---
"@revealui/setup": minor
---

Bootstrap first user as `owner` role; rename admin roles to `super-admin` and `admin`.

The first user created via the setup bootstrap now receives the `owner` role (hard-capped at 3 via app-layer soft cap). Existing `admin`-role checks should be reviewed — the former flat `admin` tier has been split into `super-admin` (full access) and `admin` (scoped).
