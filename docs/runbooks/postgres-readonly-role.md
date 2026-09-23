---
title: "Postgres readonly role (GAP-347)"
description: "Owner-run CREATE ROLE script for revealui_readonly and the revvault path for its Neon URL. No password is stored in git."
visibility: internal
status: draft
audience: maintainer
---

# Postgres readonly role (GAP-347)

Create a login role named `revealui_readonly` that can `SELECT` and cannot write.
The SQL lives in [`scripts/sql/revealui-readonly-role.sql`](../../scripts/sql/revealui-readonly-role.sql).
An agent must not run that file and must not generate or store the password.

## Vault path

Revvault paths are lower-kebab, `revealui/<tier>/<subsystem>/<leaf>`. The read-write
Neon URL already uses the leaf `postgres-url`. The readonly URL uses the sibling leaf
`postgres-url-readonly`.

| Tier | Canonical revvault path | Synced to Vercel / Fly |
| --- | --- | --- |
| prod | `revealui/prod/db/postgres-url-readonly` | no |
| staging | `revealui/staging/db/postgres-url-readonly` | no |

Both paths are declared in [`scripts/sync/secret-paths.ts`](../../scripts/sync/secret-paths.ts)
with `intentionallyUnsynced: true`. App runtimes keep using `revealui/<tier>/db/postgres-url`.
Do not add the readonly URL to a sync manifest.

The value is a Postgres connection URI for the `revealui_readonly` role, not the owner role:

```text
postgresql://revealui_readonly:<URL_ENCODED_PASSWORD>@<NEON_HOST>/<DATABASE>?sslmode=require
```

Percent-encode the password before it goes into the URI. Choose the Neon host the client
needs (pooled for serverless, direct for `psql`). The CREATE script itself must run on the
direct host.

## Owner steps

1. Generate a password yourself (password manager or a local generator). Do not commit it,
   do not paste it into chat, issues, or logs, and do not leave a filled-in SQL file on disk
   after the session.
2. Copy `scripts/sql/revealui-readonly-role.sql` to a private scratch file. Replace only the
   quoted `<OWNER_SETS_PASSWORD>` assignment. Leave the guard comparison that checks for
   that sentinel in place. Replacing every copy of the sentinel also trips the guard, and
   the role is not created.
3. Connect as the table-owner role (the role in `revealui/<tier>/db/postgres-url`) to the
   target database on the Neon **direct** endpoint. In `psql`, stop on the first error:

   ```bash
   psql "$DIRECT_OWNER_URL" -v ON_ERROR_STOP=1 -f /path/to/private-scratch.sql
   ```

   `DIRECT_OWNER_URL` comes from your own revvault session. Do not echo it.
4. Confirm the result row: `rolcanlogin` true, and `rolsuper`, `rolcreatedb`,
   `rolcreaterole`, `rolreplication`, and `rolbypassrls` all false.
5. As `revealui_readonly`, confirm `SELECT` works on an application table and
   `INSERT` / `UPDATE` / `DELETE` fail.
6. Delete the scratch file. Store the connection URI:

   ```bash
   revvault set revealui/prod/db/postgres-url-readonly
   ```

   `revvault set` prompts for the value. Use `revealui/staging/db/postgres-url-readonly`
   when the script was applied to the staging branch. Do not pass the URI on the command line.

The committed script raises if the sentinel is still present and the role does not exist,
so a first run of the git copy creates nothing. After the role exists, re-running the
committed file refreshes `GRANT`s and does not change the password.

## What the script grants

- `LOGIN`, with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`.
- Membership in `pg_read_all_data` (PostgreSQL 14+; Neon is 15+), so tables added later
  stay readable without re-running the script.
- `CONNECT` on the current database only, plus `USAGE` and `SELECT` on `public` (and on
  `drizzle` when that schema exists).
- `SELECT` on sequences (`currval` only). `USAGE` and `UPDATE` on sequences stay revoked,
  so the role cannot call `nextval` or `setval`.
- `ALTER DEFAULT PRIVILEGES` for objects later created by the role that runs the script.

`EXECUTE` on existing functions stays at the database default (`PUBLIC`). Revoking that
from `PUBLIC` would change the application role and is outside this script.

Row level security is not enabled on RevealUI tables. `revealui_readonly` does not have
`BYPASSRLS`. If RLS is added later, this role sees only rows its policies allow.

## Password rotation

Type this yourself in a private session after generating a new password. Do not add the
new password to the SQL file in git.

```sql
ALTER ROLE revealui_readonly WITH PASSWORD '<OWNER_SETS_PASSWORD>';
```

Then `revvault set <path> --force` with the new URI. Revoking the old password is the
`ALTER ROLE` itself; there is no second Neon URL to rotate in Vercel, because this path
is unsynced.
