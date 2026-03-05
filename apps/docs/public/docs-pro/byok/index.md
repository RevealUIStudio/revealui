# BYOK — Bring Your Own Key

Use your own LLM API keys with RevealUI Pro. Keys are stored encrypted per-user and swapped in automatically at inference time.

## Overview

BYOK lets each user (or tenant) supply their own API keys for LLM providers. RevealUI stores them encrypted with AES-256-GCM envelope encryption.

**Supported providers:**
- GROQ
- OpenAI (via user-supplied key only — not used for RevealUI-side inference)
- Anthropic (via user-supplied key only)
- Any OpenAI-compatible endpoint

## How it works

1. User provides their API key via the API or CMS settings UI
2. RevealUI encrypts the key with a per-user data key (AES-256-GCM)
3. The data key is wrapped with a master key stored in `BYOK_MASTER_KEY`
4. At inference time, `createLLMClientForUser()` decrypts and uses the key

## API endpoints

### Store a key

```http
POST /api/user/api-keys
Authorization: Bearer <session-token>
Content-Type: application/json

{
  "provider": "groq",
  "apiKey": "gsk_...",
  "label": "My GROQ key"
}
```

### List keys (masked)

```http
GET /api/user/api-keys
Authorization: Bearer <session-token>
```

Returns keys with the value masked: `gsk_****...****`.

### Delete a key

```http
DELETE /api/user/api-keys/:id
Authorization: Bearer <session-token>
```

### Rotate a key

```http
PUT /api/user/api-keys/:id/rotate
Authorization: Bearer <session-token>
Content-Type: application/json

{ "apiKey": "gsk_new_key_here" }
```

## Server-side usage

```typescript
import { createLLMClientForUser } from '@revealui/ai/byok'
import { db } from '@revealui/db'

// Automatically uses the user's stored key for their preferred provider.
// Falls back to the server's default provider if no user key is configured.
const llm = await createLLMClientForUser(userId, db)

const response = await llm.chat([
  { role: 'user', content: 'Hello!' },
])
```

## Environment configuration

```bash
# Required for BYOK to work
BYOK_MASTER_KEY=<32-byte hex key>   # openssl rand -hex 32

# Optional: default provider when no user key exists
DEFAULT_LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
```

## Security notes

- Keys are never stored in plaintext
- Master key rotation re-encrypts all user data keys
- Keys are never returned in full via the API
- Rate limiting applies to key verification endpoints
- Admin-level access cannot read user keys — only re-wrap them during rotation

## Tenant-level keys

For multi-tenant deployments, you can also configure provider keys at the tenant level:

```typescript
import { createLLMClientForTenant } from '@revealui/ai/byok'

const llm = await createLLMClientForTenant(tenantId, db)
```

User keys take precedence over tenant keys; tenant keys take precedence over server defaults.
