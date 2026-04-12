# The Five Primitives of Business Software

Every software company ships the same five things: a way to manage users, a way to manage content, a way to sell products, a way to collect payments, and increasingly, a way to run AI. These are not features. They are primitives. And yet every engineering team builds them from scratch, bolting together auth libraries, content engines, payment wrappers, and AI SDKs, spending months on plumbing before writing a single line of differentiated code.

RevealUI is an agentic business runtime. Its thesis is simple: these five primitives should be pre-wired, open source, and ready to deploy. You bring your business logic. We bring the infrastructure.

This post is a deep technical walkthrough of all five. Not marketing copy. Real code, real architecture decisions, real trade-offs.

---

## 1. Users

Authentication is the foundation. Get it wrong and nothing else matters. RevealUI's auth system is session-based, not JWT-based, and that is a deliberate choice.

### Why sessions, not JWTs

JWTs are popular because they are stateless. The server does not need to look up a session on every request. But that statelessness comes at a cost: you cannot revoke a JWT before it expires. If a user changes their password, gets compromised, or you need to force a logout, you are stuck waiting for the token to expire. You can work around this with a token blocklist, but now you have a stateful system with the complexity of JWTs and none of the benefits.

RevealUI uses database-backed sessions. Each session is a row in PostgreSQL. Validation is a single indexed query. Session revocation is instant: delete the row, the user is logged out. The session token is a 32-byte cryptographically random value, hashed with SHA-256 before storage. The raw token lives only in an `httpOnly`, `secure`, `sameSite=lax` cookie.

```typescript
// packages/auth/src/server/session.ts
export async function createSession(
  userId: string,
  options?: {
    persistent?: boolean;
    userAgent?: string;
    ipAddress?: string;
  },
): Promise<{ token: string; session: Session }> {
  const token = generateSessionToken(); // 32 bytes, base64url
  const tokenHash = hashToken(token);   // SHA-256

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (options?.persistent ? 7 : 1));

  const [session] = await db
    .insert(sessions)
    .values({
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt,
      userAgent: options?.userAgent,
      ipAddress: options?.ipAddress,
      lastActivityAt: new Date(),
    })
    .returning();

  return { token, session };
}
```

Sessions are also bound to context. When a request comes in, RevealUI validates the session token and optionally checks that the user-agent matches the one recorded at login. If the user-agent changes, the session is invalidated and the row is deleted. IP changes are logged as warnings by default and can be promoted to hard enforcement for high-security deployments.

### Password hashing

Passwords are hashed with bcrypt at 12 rounds. Not 10, not 8. Twelve rounds puts the hash computation at roughly 250ms on modern hardware, making brute force attacks on leaked hashes impractical without significant GPU resources.

```typescript
// packages/auth/src/server/auth.ts — signUp
const hashedPassword = await bcrypt.hash(password, 12);
```

### Brute force protection

Every login attempt flows through two layers of protection. First, IP-based rate limiting: 5 attempts per 15-minute window with a 30-minute block after the threshold. Second, per-email brute force tracking: 5 failed attempts trigger a 30-minute account lockout. Both use atomic storage operations to prevent race conditions under concurrent requests.

```typescript
// packages/auth/src/server/brute-force.ts
const DEFAULT_CONFIG: BruteForceConfig = {
  maxAttempts: 5,
  lockDurationMs: 30 * 60 * 1000, // 30 minutes
  windowMs: 15 * 60 * 1000,       // 15 minutes
};
```

The sign-in flow always returns the same error message regardless of whether the email exists or the password is wrong. This prevents user enumeration attacks.

### OAuth without auto-linking

RevealUI supports OAuth with GitHub, Google, and Vercel. The critical design decision here is that OAuth identities are **never** auto-linked to existing accounts by email.

Why? Auto-linking is an account takeover vector. If an attacker controls a Google account with your email address, they sign in via OAuth and instantly gain access to your existing account. RevealUI requires explicit linking: you must be authenticated with your existing session and then manually connect a provider.

```typescript
// packages/auth/src/server/oauth.ts — upsertOAuthUser
// If an account with this email already exists but was not linked via OAuth,
// reject the login. Auto-linking is an account takeover vector.
if (existingUser) {
  throw new OAuthAccountConflictError(providerUser.email);
}
```

Users can link and unlink providers from their account settings. The system prevents unlinking the last authentication method, so you cannot accidentally lock yourself out.

### Multi-factor authentication

MFA is TOTP-based (RFC 6238) using timing-safe verification. When a user enables 2FA, RevealUI generates a TOTP secret and 8 bcrypt-hashed backup codes. The setup is two-step: generate the secret, then verify a code from the authenticator app before activating MFA. Backup codes are single-use and consumed on verification.

For passwordless authentication, RevealUI implements WebAuthn passkeys using `@simplewebauthn/server`. Users can register up to 10 passkeys (biometrics, security keys, platform authenticators) and use them for primary authentication or as MFA verification for sensitive operations like disabling 2FA.

Magic links provide a recovery path: HMAC-SHA256 hashed, single-use, 15-minute expiry.

### RBAC + ABAC

Access control is enforced through composable functions that check the request context:

```typescript
// packages/core/src/auth/access.ts
export const authenticated: RevealAccessFunction = ({ req }) => !!req.user;
export const isAdmin = ({ req }) => !!req.user?.roles?.includes('admin');
export const hasRole = (role: string) => ({ req }) =>
  !!req.user?.roles?.includes(role);
export const hasAnyRole = (roles: string[]) => ({ req }) =>
  !!req.user && roles.some((role) => req.user?.roles?.includes(role));
```

These functions return booleans or `WhereClause` objects, enabling row-level security. A `WhereClause` return lets you say "authenticated users can read, but only their own records." The access control system has 58 enforcement tests proving role isolation.

### How Users connects to everything else

The user ID is the foreign key for everything. Content has an `authorId`. Products have licenses keyed to `customerId`. Payments are tied via `stripeCustomerId`. AI agent tasks are metered per `userId`. One identity, five primitives.

---

## 2. Content

Content is the second primitive. Not because it is more important than users, but because it is what users interact with first.

### Collections

Content in RevealUI is organized into collections. A collection is a typed schema with field definitions, access control rules, and lifecycle hooks. Posts, pages, media, sites -- each is a collection with its own REST API, automatically generated from the schema.

```typescript
// API: GET /api/content/posts?status=published&limit=10

// Response
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-...",
      "title": "The Five Primitives of Business Software",
      "slug": "five-primitives",
      "excerpt": "Every software company ships the same five things...",
      "content": { /* Lexical JSON state */ },
      "authorId": "user-uuid",
      "status": "published",
      "createdAt": "2026-03-17T12:00:00.000Z",
      "updatedAt": "2026-03-17T14:30:00.000Z",
      "publishedAt": "2026-03-17T15:00:00.000Z"
    }
  ]
}
```

Access control is enforced at the query level. Public requests only see published content. Non-admin users can only read and edit their own posts. Admin users see everything. The `overrideAccess` parameter is stripped from external requests at the proxy layer, so clients cannot bypass access rules.

### Rich text with XSS prevention

RevealUI uses Lexical for rich text editing. The editor state is stored as JSON, which means it can be rendered on the server without a browser. But rich text is also an XSS vector. Users can paste links with `javascript:` protocols, embed images with `data:text/html` URIs, or craft URLs that execute scripts.

RevealUI's server-side renderer sanitizes every URL before rendering:

```typescript
// packages/core/src/richtext/exports/server/rsc.tsx
export function isSafeUrl(url: string, context: 'link' | 'image' = 'link'): boolean {
  const trimmed = url.trim();
  // For image context, allow data:image/ URIs (base64 images)
  if (context === 'image' && /^data:image\//i.test(trimmed)) return true;
  // Block all data: URIs for links
  if (/^data:/i.test(trimmed)) return false;
  // Block javascript: and vbscript: protocols
  if (/^(?:javascript|vbscript):/i.test(trimmed)) return false;
  // Only allow http(s), mailto, tel, anchors, and relative paths
  return /^(?:https?:|mailto:|tel:|#|\/)/i.test(trimmed);
}
```

### Draft/live workflow

Posts support a status lifecycle: `draft`, `published`, `archived`, `scheduled`. The API enforces this at the route level. Creating a post defaults to draft. Publishing sets the `publishedAt` timestamp. Public API access always filters to `status = 'published'`.

### REST API with OpenAPI

Every route is defined using Hono's OpenAPI integration with Zod schemas. This means the API documentation is auto-generated from the actual route handlers -- not a separate spec file that drifts out of sync. The Swagger UI is available at `/docs` on the API server.

### How Content connects to everything else

Content is authored by Users (the `authorId` foreign key). Premium content can be gated behind Products (license tier checks). Content creation by AI agents feeds back through the Intelligence layer. Media uploads integrate with CDN delivery via the cache package.

---

## 3. Products

Products are what turns your software from a project into a business. RevealUI's product primitive covers the catalog, license generation, and runtime feature gating.

### License keys: RSA-signed JWTs

License keys are JWT tokens signed with RS256 (RSA + SHA-256). The payload contains the tier, customer ID, domain restrictions, site and user limits, and an optional perpetual flag. The private key signs; the public key verifies. This means license verification can happen offline, without calling home to a license server.

```typescript
// packages/core/src/license.ts
export type LicenseTier = 'free' | 'pro' | 'max' | 'enterprise';

const licensePayloadSchema = z.object({
  tier: z.enum(['pro', 'max', 'enterprise']),
  customerId: z.string(),
  domains: z.array(z.string()).optional(),
  maxSites: z.number().int().positive().optional(),
  maxUsers: z.number().int().positive().optional(),
  perpetual: z.boolean().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
```

Perpetual licenses omit the `exp` claim entirely. They are valid forever unless explicitly revoked in the database.

### Feature gating

The feature gate is a simple function: given a feature name, check if the current license tier meets the minimum requirement.

```typescript
// packages/core/src/features.ts
const featureTierMap: Record<keyof FeatureFlags, LicenseTier> = {
  ai: 'pro',
  mcp: 'pro',
  payments: 'pro',
  advancedSync: 'pro',
  aiMemory: 'max',
  aiInference: 'max',
  multiTenant: 'enterprise',
  whiteLabel: 'enterprise',
  sso: 'enterprise',
};

export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const requiredTier = featureTierMap[feature];
  return isLicensed(requiredTier);
}
```

This is used as middleware in the API. AI routes check `requireFeature('ai')`. Multi-tenant routes check `requireFeature('multiTenant')`. The check is a tier comparison, not a boolean flag, so upgrading your license automatically unlocks all features at or below your tier.

### Three pricing tracks

RevealUI supports three billing models simultaneously:

1. **Subscriptions** -- Monthly recurring charges via Stripe. Standard for SaaS.
2. **Agent credits** -- Usage-based metering for AI tasks. Pro tier gets 10,000 tasks/month, Max gets 50,000, Forge is unlimited. Overage is reported to Stripe Billing Meters.
3. **Perpetual licenses** -- One-time purchase, own forever, with an optional annual support renewal. The license JWT has no expiration, and the system tracks `supportExpiresAt` separately from the license validity.

### License verification API

```
POST /api/license/verify
Content-Type: application/json

{ "licenseKey": "eyJhbGciOiJSUzI1NiIs..." } // gitleaks:allow
```

```json
{
  "valid": true,
  "tier": "pro",
  "customerId": "cus_abc123",
  "features": {
    "ai": true,
    "mcp": true,
    "payments": true,
    "multiTenant": false,
    "whiteLabel": false,
    "sso": false
  },
  "maxSites": 5,
  "maxUsers": 25,
  "expiresAt": "2027-03-17T00:00:00.000Z"
}
```

Verification checks both the JWT signature and the database. A structurally valid JWT can still be revoked in the database (chargeback, refund, manual revoke), so the verify endpoint checks both. The license cache TTL is 15 minutes, meaning a revoked license loses access within 15 minutes at most.

### How Products connects to everything else

Products are purchased by Users. License keys are generated from the Payments webhook. Feature gates control access to Content (premium collections) and Intelligence (AI agent execution). The tier hierarchy flows through the entire stack.

---

## 4. Payments

Payments are where business software earns its name. RevealUI integrates Stripe end-to-end: checkout, portal, subscription lifecycle, refunds, chargebacks, and usage reporting.

### Circuit breaker protection

Every Stripe API call goes through a circuit breaker. If Stripe returns 5 consecutive failures, the breaker opens and requests fail fast with a 503 for 30 seconds instead of piling up timeouts. After the cooldown, 2 successful requests close the breaker.

```typescript
// apps/api/src/routes/billing.ts
const stripeBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30_000,
  successThreshold: 2,
});

async function withStripe<T>(operation: (stripe: Stripe) => Promise<T>): Promise<T> {
  try {
    return await stripeBreaker.execute(() => operation(getStripeClient()));
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      throw new HTTPException(503, {
        message: 'Payment service temporarily unavailable. Please try again shortly.',
      });
    }
    throw error;
  }
}
```

### DB-backed webhook idempotency

Stripe delivers webhooks at least once. In a multi-region deployment (Vercel edge), the same webhook can arrive at different instances simultaneously. RevealUI uses a `processed_webhook_events` table with an atomic INSERT to deduplicate:

```typescript
// apps/api/src/routes/webhooks.ts
async function checkAndMarkProcessed(
  db: Database,
  eventId: string,
  eventType: string,
): Promise<boolean> {
  try {
    await db.insert(processedWebhookEvents).values({
      id: eventId,
      eventType,
      processedAt: new Date(),
    });
    return false; // Not a duplicate -- insert succeeded
  } catch (err) {
    // PostgreSQL unique constraint violation = already processed
    if ((err as { code?: string }).code === '23505') return true;
    throw err; // Unknown error -- return 500 so Stripe retries
  }
}
```

If the INSERT succeeds, this is the first time we have seen this event. If it hits a unique constraint violation, another instance already processed it. Any other database error returns 500 to Stripe, which will retry the webhook -- safe because our deduplication is idempotent.

### Subscription lifecycle

The webhook handler covers the full subscription lifecycle:

- **`checkout.session.completed`** -- Creates the Stripe customer record, generates an RSA-signed license key, inserts it into the licenses table, and sends the activation email.
- **`customer.subscription.updated`** -- Handles tier upgrades (new license key at the higher tier) and reactivation (payment recovered after a failed charge). On successful payment recovery, the license is re-activated and the user gets a recovery notification.
- **`customer.subscription.deleted`** -- Revokes the license and downgrades to free.
- **`invoice.payment_failed`** -- Sends a payment failure notification with a link to update billing details.
- **`charge.dispute.closed`** -- On dispute loss, automatically revokes the license. The customer is notified and directed to re-purchase.
- **`customer.subscription.trial_will_end`** -- Sends a 3-day trial ending reminder.

### x402 for agent-to-agent commerce

RevealUI supports the x402 payment protocol for machine-to-machine payments. Agents can discover payment methods via `/.well-known/payment-methods.json` and pay per-task in USDC on Base. This enables an economy where AI agents can purchase compute, data, and services from other agents without human intervention.

### How Payments connects to everything else

Payments are initiated by Users (checkout requires a session). Successful payments generate Products (license keys). Payment status controls feature access across Content and Intelligence. Webhook events update the Users table (`stripeCustomerId`) and the licenses table (Products). Chargebacks revoke licenses instantly.

---

## 5. Intelligence (AI) -- Pro Tier

The fifth primitive is AI. Not a chatbot bolted onto a sidebar, but an agent orchestration system with memory, streaming, and inter-agent communication.

### Agent streaming

AI agent execution streams results in real-time using Server-Sent Events. The client posts an instruction, and the server streams execution events as they happen:

```typescript
// apps/api/src/routes/agent-stream.ts
app.openapi(agentStreamRoute, async (c) => {
  const body = c.req.valid('json');

  // Dynamic import -- @revealui/ai is only loaded for Pro+ licenses
  const [aiMod, llmClientMod, streamingRuntimeMod] = await Promise.all([
    import('@revealui/ai').catch(() => null),
    import('@revealui/ai/llm/client').catch(() => null),
    import('@revealui/ai/orchestration/streaming-runtime').catch(() => null),
  ]);

  if (!(aiMod && llmClientMod && streamingRuntimeMod)) {
    return c.json({ error: "Feature 'ai' requires a Pro or Enterprise license." }, 403);
  }

  // Create inference client from environment (snaps > Ollama)
  const llmClient = llmClientMod.createLLMClientFromEnv();

  const runtime = new streamingRuntimeMod.StreamingAgentRuntime({
    maxIterations: 10,
    timeout: 120_000,
  });

  return streamSSE(c, async (stream) => {
    for await (const chunk of runtime.streamTask(agent, task, llmClient)) {
      await stream.writeSSE({ data: JSON.stringify(chunk), event: chunk.type });
      if (chunk.type === 'done' || chunk.type === 'error') break;
    }
  });
});
```

The `@revealui/ai` package is loaded dynamically. If the license is free, the import returns null and the route returns 403. No AI code is ever loaded into memory for free-tier deployments.

### Open-Model Inference

RevealUI runs AI on open models only  -  no proprietary cloud APIs, no vendor lock-in, no API bills. The inference path is auto-detected from environment variables:

1. **Ubuntu Inference Snaps** (recommended)  -  Canonical snap runtime (Gemma3, DeepSeek-R1, Qwen-VL, Nemotron-Nano)
2. **Ollama** (fallback)  -  Any open source GGUF model (chat: `gemma4:e2b`, embeddings: `nomic-embed-text`)

### CRDT-based memory system

The AI memory system uses four memory types, modeled on cognitive science:

- **Episodic** -- Records of past interactions and their outcomes. "What happened the last time we ran this task?"
- **Working** -- Short-term context for the current task. Cleared between sessions.
- **Semantic** -- Long-term knowledge stored as vector embeddings in Supabase. Enables retrieval-augmented generation without external vector databases.
- **Procedural** -- Learned procedures and workflows. "How do we deploy to production?"

Memory operations use CRDTs (Conflict-free Replicated Data Types) for conflict resolution, so multiple agents can write to the same memory space without coordination locks.

### MCP servers

RevealUI ships six MCP (Model Context Protocol) servers, open source under MIT:

| Server | Purpose |
|--------|---------|
| Stripe | Query customers, invoices, subscriptions from AI agents |
| Supabase | Execute vector searches and auth operations |
| Neon | Run SQL queries and manage database branches |
| Vercel | Deploy, inspect deployments, manage environment variables |
| Code Validator | Static analysis and lint checking within agent workflows |
| Playwright | Browser automation for testing and scraping |

These servers are tools that agents can invoke during task execution. An agent can query your Stripe dashboard, check your deployment status, and run your test suite without you writing integration code.

### A2A protocol

RevealUI implements the Google A2A (Agent-to-Agent) specification over JSON-RPC 2.0. Agents expose discovery cards at `/.well-known/agent.json` and accept tasks via `POST /a2a`. The protocol supports:

- **`tasks/send`** -- Submit a task and get a result
- **`tasks/sendSubscribe`** -- Submit a task and subscribe to streaming updates
- **`tasks/get`** -- Poll task status
- **`tasks/cancel`** -- Cancel a running task

Task execution is gated behind the `ai` feature flag and metered against the user's quota. Every task execution is persisted to the `agentActions` table with timing data for billing and debugging.

### Agent task metering

AI is not free. RevealUI tracks task usage per billing cycle:

| Tier | Monthly quota |
|------|---------------|
| Free | 1,000 tasks |
| Pro | 10,000 tasks |
| Max | 50,000 tasks |
| Forge      | Unlimited |

Overage beyond the quota is tracked in the `agent_task_usage` table and reported to Stripe Billing Meters at the end of each cycle via a cron job. This enables usage-based pricing without blocking execution in real-time.

### How Intelligence connects to everything else

AI agents authenticate through the Users system (session cookies or API keys). Agents create and modify Content (posts, pages, media). Agent execution is metered as a Product (task quotas per tier). Overage billing feeds through Payments (Stripe Billing Meters). The A2A protocol enables agents to purchase services from other agents via x402, closing the loop.

---

## The Compound Effect

Any one of these primitives can be built in a weekend with the right libraries. But the compound effect of all five, pre-integrated and tested together, is what turns months of boilerplate into a single `npx create-revealui`.

The five primitives are not independent features. They are a directed graph:

```
Users --> Content (authorship)
Users --> Products (licensing)
Users --> Payments (billing)
Users --> Intelligence (metering)
Products --> Content (feature gating)
Products --> Intelligence (feature gating)
Payments --> Products (license generation)
Intelligence --> Content (AI authoring)
Intelligence --> Payments (usage billing)
```

Every edge in that graph is a piece of integration code you do not have to write. Every node is a piece of infrastructure you do not have to maintain. And because RevealUI is open source (MIT for the core, source-available for Pro), you can read every line, fork every module, and extend every API.

Build your business, not your boilerplate.

---

*RevealUI is an agentic business runtime. The core framework -- Users, Content, Products, and Payments -- is MIT licensed and free forever. Intelligence (AI agents, memory, MCP servers) is available with a Pro license. Learn more at [revealui.com](https://revealui.com).*
