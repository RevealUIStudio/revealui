# `@revealui/secrets`

Uniform secret retrieval. The daemon and apps look the same on every host; only provider construction differs.

## `resolveSecret(name)`

Auto-detects, in order:

| Marker | Provider |
|--------|----------|
| `KUBERNETES_SERVICE_HOST` | `FileProvider` (`/var/run/secrets/revealui/<name>`) |
| `revvault` on PATH | `RevvaultProvider` (`revvault get --full <name>`) |
| else (`VERCEL`, `CF_PAGES`, Docker, local) | `EnvProvider` (`process.env[name]`) |

Env is always the last fallback.

```ts
import { resolveSecret } from '@revealui/secrets';

const key = await resolveSecret('REVEALUI_LICENSE_KEY');
```

## Providers

```ts
import { ChainProvider, EnvProvider, FileProvider, RevvaultProvider } from '@revealui/secrets';

const secrets = new ChainProvider([
  new FileProvider({ pathEnvVar: 'REVEALUI_LICENSE_KEY_FILE' }),
  new EnvProvider(),
  new RevvaultProvider(),
]);
await secrets.get('REVEALUI_LICENSE_KEY');
```

## Customer fleet

- **Vercel / Cloudflare / Railway / Docker:** inject env; `EnvProvider` is enough.
- **Kubernetes:** mount secrets at `/var/run/secrets/revealui/`.
- **Local studio:** install `revvault`; `resolveSecret` shells out instead of persisting into the parent shell env.

Out of scope: AWS/GCP/Vault HTTP providers, file-watch rotation, encryption at rest.
