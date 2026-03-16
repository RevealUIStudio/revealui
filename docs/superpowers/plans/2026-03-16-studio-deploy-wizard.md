# Studio Deploy Wizard — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all gaps between the existing Deploy Wizard implementation and the design spec at `docs/superpowers/specs/2026-03-15-studio-installer-wizard-design.md`.

**Architecture:** The wizard scaffolding is ~80% built — all 9 step components, Tauri IPC bridges, Rust commands, and config persistence exist. This plan fills specific functional gaps in each step (project creation, webhook secret capture, SMTP testing, token validation, env var completeness) and adds missing test coverage for deploy step components.

**Tech Stack:** React 19, TypeScript, Tauri 2 (Rust), Vitest, React Testing Library, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-15-studio-installer-wizard-design.md`

---

## File Structure

### Files to Modify

| File | Responsibility | Changes |
|------|---------------|---------|
| `apps/studio/src/components/deploy/StepVercel.tsx` | Vercel connection | Add project creation/linking after token validation |
| `apps/studio/src/components/deploy/StepStripe.tsx` | Stripe connection | Add RSA key generation via Rust, parse seed output for webhook secret + price IDs |
| `apps/studio/src/components/deploy/StepEmail.tsx` | Email provider | Wire SMTP test via new Tauri command |
| `apps/studio/src/components/deploy/StepBlob.tsx` | Blob storage | Add token validation via Vercel API |
| `apps/studio/src/components/deploy/StepDomain.tsx` | Domain config | Add signup whitelist, brand color, brand logo fields |
| `apps/studio/src/components/deploy/StepSecrets.tsx` | Secret generation | No functional changes — secrets are correct as-is |
| `apps/studio/src/components/deploy/StepDeploy.tsx` | Deployment | Add Supabase env vars when enabled, add CMS email vars |
| `apps/studio/src/components/deploy/StepVerify.tsx` | Verification | Add email delivery check |
| `apps/studio/src/lib/deploy.ts` | Tauri IPC bridge | Add `smtpSendTest()`, `vercelValidateBlobToken()` bridge functions |
| `apps/studio/src/types.ts` | TypeScript types | Add `signupWhitelist`, `brandColor`, `brandLogo` to `WizardData` |
| `apps/studio/src/components/deploy/DeployWizard.tsx` | Wizard container | Add new WizardData fields to `EMPTY_WIZARD_DATA` |
| `apps/studio/src-tauri/src/commands/deploy/email.rs` | Rust SMTP test | Add `smtp_send_test` command |
| `apps/studio/src-tauri/src/commands/deploy/vercel.rs` | Rust blob validation | Add `vercel_validate_blob_token` command |
| `apps/studio/src-tauri/src/lib.rs` | Command registration | Register 2 new commands |

### Files to Create (Tests)

| File | Tests |
|------|-------|
| `apps/studio/src/__tests__/components/StepVercel.test.tsx` | StepVercel component tests |
| `apps/studio/src/__tests__/components/StepStripe.test.tsx` | StepStripe component tests |
| `apps/studio/src/__tests__/components/StepEmail.test.tsx` | StepEmail component tests |
| `apps/studio/src/__tests__/components/StepBlob.test.tsx` | StepBlob component tests |
| `apps/studio/src/__tests__/components/StepSecrets.test.tsx` | StepSecrets component tests |
| `apps/studio/src/__tests__/components/StepDeploy.test.tsx` | StepDeploy component tests |
| `apps/studio/src/__tests__/components/StepVerify.test.tsx` | StepVerify component tests |
| `apps/studio/src/__tests__/lib/deploy.test.ts` | Deploy IPC bridge tests |

---

## Chunk 1: Steps 1-4 (Vercel, Stripe, Email, Secrets)

### Task 1: StepVercel — Add Project Creation/Linking

The current `StepVercel` only validates the token and lists existing projects. Per spec, after validation it must **link or create** the 3 required Vercel projects (`revealui-api`, `revealui-cms`, `revealui-marketing`). The Rust `vercel_create_project` command exists. The TS bridge `vercelCreateProject()` exists in `deploy.ts`. Neither is called from the UI.

**Files:**
- Modify: `apps/studio/src/components/deploy/StepVercel.tsx`
- Create: `apps/studio/src/__tests__/components/StepVercel.test.tsx`

- [ ] **Step 1: Write test for StepVercel rendering**

```typescript
// apps/studio/src/__tests__/components/StepVercel.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepVercel from '../../components/deploy/StepVercel';
import type { StudioConfig, WizardData } from '../../types';

vi.mock('../../lib/deploy', () => ({
  vercelValidateToken: vi.fn(),
  vercelCreateProject: vi.fn(),
}));

const MOCK_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: false,
  completedSteps: [],
};

const MOCK_DATA: WizardData = {
  vercelToken: '',
  vercelProjects: { api: '', cms: '', marketing: '' },
  postgresUrl: '',
  stripeSecretKey: '',
  stripePublishableKey: '',
  stripeWebhookSecret: '',
  stripePriceIds: { pro: '', max: '', enterprise: '' },
  licensePrivateKey: '',
  licensePublicKey: '',
  emailProvider: 'resend',
  blobToken: '',
  revealuiSecret: '',
  revealuiKek: '',
  cronSecret: '',
  domain: '',
  signupOpen: true,
};

describe('StepVercel', () => {
  it('renders token input and validate button', () => {
    render(
      <StepVercel
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Connect Vercel')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your Vercel API token')).toBeInTheDocument();
    expect(screen.getByText('Validate Token')).toBeInTheDocument();
  });

  it('disables Validate button when token is empty', () => {
    render(
      <StepVercel
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Validate Token')).toBeDisabled();
  });

  it('disables Next button until validated', () => {
    render(
      <StepVercel
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Next')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it passes with current component**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepVercel.test.tsx`
Expected: PASS (3 tests — these test existing behavior)

- [ ] **Step 3: Write test for project creation flow**

Add to `StepVercel.test.tsx`:

```typescript
import { vercelValidateToken, vercelCreateProject } from '../../lib/deploy';

it('creates missing projects after validation', async () => {
  const mockValidate = vi.mocked(vercelValidateToken);
  const mockCreate = vi.mocked(vercelCreateProject);
  const onUpdateData = vi.fn();
  const onUpdateConfig = vi.fn();

  // No existing projects match our required names
  mockValidate.mockResolvedValue([
    { id: 'prj_other', name: 'some-other-project', framework: null },
  ]);
  mockCreate.mockImplementation(async (_token, name) => ({
    id: `prj_${name}`,
    name,
    framework: null,
  }));

  render(
    <StepVercel
      config={MOCK_CONFIG}
      data={MOCK_DATA}
      onUpdateData={onUpdateData}
      onUpdateConfig={onUpdateConfig}
      onNext={vi.fn()}
    />,
  );

  fireEvent.change(screen.getByPlaceholderText('Enter your Vercel API token'), {
    target: { value: 'test-token' },
  });
  fireEvent.click(screen.getByText('Validate Token'));

  await waitFor(() => {
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  // Should update data with project IDs
  expect(onUpdateData).toHaveBeenCalledWith(
    expect.objectContaining({
      vercelToken: 'test-token',
      vercelProjects: expect.objectContaining({
        api: expect.any(String),
        cms: expect.any(String),
        marketing: expect.any(String),
      }),
    }),
  );
});

it('reuses existing projects when names match', async () => {
  const mockValidate = vi.mocked(vercelValidateToken);
  const mockCreate = vi.mocked(vercelCreateProject);
  const onUpdateData = vi.fn();
  const onUpdateConfig = vi.fn();

  mockValidate.mockResolvedValue([
    { id: 'prj_existing_api', name: 'revealui-api', framework: 'hono' },
    { id: 'prj_existing_cms', name: 'revealui-cms', framework: 'nextjs' },
    { id: 'prj_existing_mktg', name: 'revealui-marketing', framework: 'nextjs' },
  ]);

  render(
    <StepVercel
      config={MOCK_CONFIG}
      data={MOCK_DATA}
      onUpdateData={onUpdateData}
      onUpdateConfig={onUpdateConfig}
      onNext={vi.fn()}
    />,
  );

  fireEvent.change(screen.getByPlaceholderText('Enter your Vercel API token'), {
    target: { value: 'test-token' },
  });
  fireEvent.click(screen.getByText('Validate Token'));

  await waitFor(() => {
    expect(screen.getByText('Next')).not.toBeDisabled();
  });

  // Should NOT create projects — all 3 exist
  expect(mockCreate).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepVercel.test.tsx`
Expected: FAIL on "creates missing projects" and "reuses existing projects" tests

- [ ] **Step 5: Modify Rust vercel_validate_token to return teamId**

The Vercel `/v9/projects` API response includes a top-level pagination object. To capture `teamId`, modify `apps/studio/src-tauri/src/commands/deploy/vercel.rs`:

```rust
// Add a richer return type that includes teamId
#[derive(Serialize, Deserialize)]
pub struct VercelValidationResult {
    pub projects: Vec<VercelProject>,
    pub team_id: Option<String>,
}

// In vercel_validate_token, parse the teamId from the first project's accountId or
// make a separate call to /v2/teams. Simplest: Vercel project objects DO have an
// `accountId` field (team owner) — add it to VercelProject:
#[derive(Serialize, Deserialize)]
pub struct VercelProject {
    pub id: String,
    pub name: String,
    pub framework: Option<String>,
    #[serde(rename = "accountId")]
    pub account_id: Option<String>,
}
```

Update `vercel_validate_token` to return `VercelValidationResult` and extract `account_id` from the first project as the team ID. Update the TS `VercelProject` type in `types.ts` to add `accountId?: string`.

- [ ] **Step 6: Implement project creation in StepVercel**

Modify `apps/studio/src/components/deploy/StepVercel.tsx`:

1. Import `vercelCreateProject` from `../../lib/deploy`
2. Add a `linking` phase state after token validation
3. After `vercelValidateToken` succeeds:
   - Check which of `revealui-api`, `revealui-cms`, `revealui-marketing` exist in `projects`
   - For missing ones, call `vercelCreateProject(token, name, framework, rootDir)`:
     - `('revealui-api', 'other', 'apps/api')`
     - `('revealui-cms', 'nextjs', 'apps/cms')`
     - `('revealui-marketing', 'nextjs', 'apps/marketing')`
   - Build a `vercelProjects` map `{ api: id, cms: id, marketing: id }`
4. Call `onUpdateData({ vercelToken, vercelProjects })`
5. Call `onUpdateConfig({ deploy: { ...config.deploy, apps: vercelProjects, supabaseEnabled: ... } })`
6. Show linked/created project names in the UI

```typescript
const REQUIRED_PROJECTS = [
  { key: 'api' as const, name: 'revealui-api', framework: 'other', rootDir: 'apps/api' },
  { key: 'cms' as const, name: 'revealui-cms', framework: 'nextjs', rootDir: 'apps/cms' },
  { key: 'marketing' as const, name: 'revealui-marketing', framework: 'nextjs', rootDir: 'apps/marketing' },
];

// Inside handleValidate, after vercelValidateToken succeeds:
const projectMap: Record<string, string> = {};
for (const req of REQUIRED_PROJECTS) {
  const existing = result.find((p) => p.name === req.name);
  if (existing) {
    projectMap[req.key] = existing.id;
  } else {
    const created = await vercelCreateProject(trimmed, req.name, req.framework, req.rootDir);
    projectMap[req.key] = created.id;
  }
}

onUpdateData({
  vercelToken: trimmed,
  vercelProjects: {
    api: projectMap.api ?? '',
    cms: projectMap.cms ?? '',
    marketing: projectMap.marketing ?? '',
  },
});

// Capture team/org ID from the Vercel project's accountId (spec requires it)
// accountId is the team owner's ID — available on every VercelProject
const teamId = result[0]?.accountId ?? '';

await onUpdateConfig({
  deploy: {
    ...config.deploy,
    vercelTeamId: teamId,
    apps: { api: projectMap.api, cms: projectMap.cms, marketing: projectMap.marketing },
    supabaseEnabled: config.deploy?.supabaseEnabled ?? false,
  },
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepVercel.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/components/deploy/StepVercel.tsx apps/studio/src/__tests__/components/StepVercel.test.tsx
git commit -m "feat(studio): wire Vercel project creation/linking in StepVercel"
```

---

### Task 2: StepStripe — Wire Webhook Secret, Catalog Sync, Price IDs, RSA Keys

The current `StepStripe` validates keys, runs `stripeRunKeys` and `stripeRunSeed`, but:
1. Does NOT generate RSA keypair for license signing (spec step 3, item 2)
2. Does NOT capture webhook secret or price IDs from seed output
3. Does NOT run catalog sync

**Key discoveries from script investigation:**
- `pnpm stripe:keys` is NOT registered in root `package.json` — the Rust `stripe_run_keys` command will fail. Use `generateRsaKeypair()` (Rust RSA-2048) instead.
- `pnpm stripe:seed` (`scripts/setup/seed-stripe.ts`) writes `.revealui/stripe-env.json` containing `{ envVars: { STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PRO_PRICE_ID, ... }, catalogEntries }`. The Rust command returns stdout but the real data is in this file.
- `stripe:seed` already calls `billing:catalog:sync` internally (unless `--skip-catalog-sync`), so a separate `stripeCatalogSync` call is redundant.

**Files:**
- Modify: `apps/studio/src/components/deploy/StepStripe.tsx`
- Modify: `apps/studio/src/lib/deploy.ts` (add return type for seed output)
- Create: `apps/studio/src/__tests__/components/StepStripe.test.tsx`

- [ ] **Step 1: Write test for StepStripe rendering and phase flow**

```typescript
// apps/studio/src/__tests__/components/StepStripe.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepStripe from '../../components/deploy/StepStripe';
import type { StudioConfig, WizardData } from '../../types';

vi.mock('../../lib/deploy', () => ({
  stripeValidateKeys: vi.fn(),
  stripeRunSeed: vi.fn(),
  generateRsaKeypair: vi.fn(),
}));

const MOCK_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: false,
  completedSteps: [],
};

// Use same MOCK_DATA pattern as other tests (full WizardData)

describe('StepStripe', () => {
  it('renders key inputs and connect button', () => {
    render(
      <StepStripe config={MOCK_CONFIG} data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />,
    );

    expect(screen.getByText('Connect Stripe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sk_test_...')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('pk_test_...')).toBeInTheDocument();
  });

  it('disables Connect button when keys are empty', () => {
    render(
      <StepStripe config={MOCK_CONFIG} data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />,
    );

    // The button text includes an HTML entity — use getByRole
    const connectBtn = screen.getByRole('button', { name: /Connect/i });
    expect(connectBtn).toBeDisabled();
  });

  it('runs full phase sequence: validate → generate RSA → seed (captures webhook secret + price IDs)', async () => {
    const { stripeValidateKeys, stripeRunSeed, generateRsaKeypair } =
      await import('../../lib/deploy');
    const onUpdateData = vi.fn();

    vi.mocked(stripeValidateKeys).mockResolvedValue(true);
    vi.mocked(generateRsaKeypair).mockResolvedValue(['PRIVATE_PEM', 'PUBLIC_PEM']);
    // stripe:seed writes .revealui/stripe-env.json — Rust command reads it and returns JSON
    vi.mocked(stripeRunSeed).mockResolvedValue(JSON.stringify({
      envVars: {
        STRIPE_WEBHOOK_SECRET: 'whsec_test123',
        NEXT_PUBLIC_STRIPE_PRO_PRICE_ID: 'price_pro',
        NEXT_PUBLIC_STRIPE_MAX_PRICE_ID: 'price_max',
        NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID: 'price_ent',
      },
    }));

    render(
      <StepStripe config={MOCK_CONFIG} data={MOCK_DATA} onUpdateData={onUpdateData} onNext={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText('sk_test_...'), {
      target: { value: 'sk_test_abc' },
    });
    fireEvent.change(screen.getByPlaceholderText('pk_test_...'), {
      target: { value: 'pk_test_xyz' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Connect/i }));

    await waitFor(() => {
      expect(screen.getByText('Stripe connected')).toBeInTheDocument();
    });

    expect(stripeValidateKeys).toHaveBeenCalledWith('sk_test_abc');
    expect(generateRsaKeypair).toHaveBeenCalled();
    expect(stripeRunSeed).toHaveBeenCalled();
    // stripeCatalogSync is NOT called separately — stripe:seed runs it internally

    // Verify parsed webhook secret + price IDs are passed to onUpdateData
    expect(onUpdateData).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeWebhookSecret: 'whsec_test123',
        stripePriceIds: { pro: 'price_pro', max: 'price_max', enterprise: 'price_ent' },
        licensePrivateKey: 'PRIVATE_PEM',
        licensePublicKey: 'PUBLIC_PEM',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepStripe.test.tsx`
Expected: FAIL (phase sequence test fails — current code doesn't call `generateRsaKeypair`, `stripeCatalogSync`, or parse seed output)

- [ ] **Step 3: Modify Rust stripe_run_seed to return stripe-env.json contents**

The current `stripe_run_seed` in `apps/studio/src-tauri/src/commands/deploy/stripe.rs` returns process stdout. But the actual env var data (webhook secret, price IDs) is written to `.revealui/stripe-env.json` by the seed script. Modify the Rust command to read that file after the seed completes:

```rust
#[tauri::command]
pub async fn stripe_run_seed(repo_path: String) -> Result<String, StudioError> {
    let output = Command::new("pnpm")
        .arg("stripe:seed")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| StudioError::Process(format!("Failed to run stripe:seed: {}", e)))?;

    if !output.status.success() {
        return Err(StudioError::Process(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    // Read .revealui/stripe-env.json which contains envVars + catalogEntries
    let env_file = std::path::Path::new(&repo_path).join(".revealui/stripe-env.json");
    match std::fs::read_to_string(&env_file) {
        Ok(contents) => Ok(contents),
        Err(_) => {
            // Fallback to stdout if the file doesn't exist (older seed script)
            Ok(String::from_utf8_lossy(&output.stdout).to_string())
        }
    }
}
```

- [ ] **Step 4: Implement full Stripe flow in StepStripe**

Modify `apps/studio/src/components/deploy/StepStripe.tsx`:

1. Import `generateRsaKeypair` from `../../lib/deploy` (remove `stripeRunKeys` import — not needed)
2. Add new phase: `'generating-rsa'` (remove `'syncing-catalog'` — seed does it internally)
3. Update `handleConnect()` flow:

```typescript
type Phase = 'input' | 'validating' | 'generating-rsa' | 'seeding' | 'done';

const PHASE_LABELS: Record<Phase, string> = {
  input: '',
  validating: 'Validating keys...',
  'generating-rsa': 'Generating license keys...',
  seeding: 'Creating Stripe products, prices & syncing catalog...',
  done: 'Stripe connected',
};

async function handleConnect() {
  // ... existing trim/guard ...
  try {
    setPhase('validating');
    await stripeValidateKeys(trimmedSecret);

    // Generate RSA-2048 keypair via Rust (NOT stripeRunKeys — that script isn't registered in package.json)
    setPhase('generating-rsa');
    const [privateKey, publicKey] = await generateRsaKeypair();

    // Seed creates products, prices, webhook endpoint, billing portal, AND runs catalog sync
    // The Rust command reads .revealui/stripe-env.json after seed completes and returns its contents
    setPhase('seeding');
    const seedOutput = await stripeRunSeed('.');

    // Parse webhook secret + price IDs from .revealui/stripe-env.json (returned by Rust command)
    let webhookSecret = '';
    let priceIds = { pro: '', max: '', enterprise: '' };
    try {
      const parsed = JSON.parse(seedOutput);
      if (parsed.envVars) {
        webhookSecret = parsed.envVars.STRIPE_WEBHOOK_SECRET ?? '';
        priceIds = {
          pro: parsed.envVars.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? '',
          max: parsed.envVars.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID ?? '',
          enterprise: parsed.envVars.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID ?? '',
        };
      }
    } catch {
      // Seed output may not be JSON — webhook secret + price IDs left empty (user enters manually)
    }

    setPhase('done');
    onUpdateData({
      stripeSecretKey: trimmedSecret,
      stripePublishableKey: trimmedPublishable,
      stripeWebhookSecret: webhookSecret,
      stripePriceIds: priceIds,
      licensePrivateKey: privateKey,
      licensePublicKey: publicKey,
    });
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Stripe setup failed');
    setPhase('input');
  }
}
```

4. Add a webhook secret input field that pre-fills from the seed output but allows manual override:

```tsx
<Input
  id="stripe-webhook-secret"
  label="Webhook Secret"
  hint="Auto-filled from seed — paste from Stripe dashboard if needed"
  type="password"
  placeholder="whsec_..."
  value={webhookSecret}
  onChange={(e) => setWebhookSecret(e.target.value)}
  disabled={isRunning}
  mono
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepStripe.test.tsx`
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/studio/src-tauri/src/commands/deploy/stripe.rs apps/studio/src/components/deploy/StepStripe.tsx apps/studio/src/__tests__/components/StepStripe.test.tsx
git commit -m "feat(studio): wire full Stripe flow — RSA keys, seed env capture, webhook secret, price IDs"
```

---

### Task 3: StepEmail — Add SMTP Test Command

The current `StepEmail` has a comment: `// SMTP test would go through a different Tauri command`. The Rust backend only has `resend_send_test`. Need to add an SMTP test command.

**Files:**
- Modify: `apps/studio/src-tauri/src/commands/deploy/email.rs` (add `smtp_send_test`)
- Modify: `apps/studio/src-tauri/src/lib.rs` (register command)
- Modify: `apps/studio/src/lib/deploy.ts` (add `smtpSendTest` bridge)
- Modify: `apps/studio/src/components/deploy/StepEmail.tsx` (wire SMTP test)
- Create: `apps/studio/src/__tests__/components/StepEmail.test.tsx`

- [ ] **Step 1: Write test for StepEmail**

```typescript
// apps/studio/src/__tests__/components/StepEmail.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepEmail from '../../components/deploy/StepEmail';
import type { StudioConfig, WizardData } from '../../types';

vi.mock('../../lib/deploy', () => ({
  resendSendTest: vi.fn().mockResolvedValue(true),
  smtpSendTest: vi.fn().mockResolvedValue(true),
}));

// ... MOCK_CONFIG, MOCK_DATA ...

describe('StepEmail', () => {
  it('renders provider toggle (Resend / SMTP)', () => {
    render(
      <StepEmail
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Resend')).toBeInTheDocument();
    expect(screen.getByText('SMTP')).toBeInTheDocument();
  });

  it('shows SMTP fields when SMTP is selected', () => {
    render(
      <StepEmail
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('SMTP'));

    expect(screen.getByPlaceholderText('smtp.example.com')).toBeInTheDocument();
  });

  it('disables Next until test email is sent', () => {
    render(
      <StepEmail
        config={MOCK_CONFIG}
        data={MOCK_DATA}
        onUpdateData={vi.fn()}
        onUpdateConfig={vi.fn()}
        onNext={vi.fn()}
      />,
    );

    expect(screen.getByText('Next')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it passes with current component**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepEmail.test.tsx`
Expected: PASS (tests basic rendering)

- [ ] **Step 3: Add Rust SMTP test command**

Add to `apps/studio/src-tauri/src/commands/deploy/email.rs`:

```rust
/// Send a test email via SMTP.
#[tauri::command]
pub async fn smtp_send_test(
    host: String,
    port: u16,
    user: String,
    pass: String,
    to_email: String,
) -> Result<bool, StudioError> {
    use lettre::{
        message::Mailbox,
        transport::smtp::authentication::Credentials,
        AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    };

    // Use the SMTP user as the "from" address — self-hosters won't have noreply@revealui.com
    let from_addr = format!("RevealUI Studio <{}>", user);
    let email = Message::builder()
        .from(from_addr.parse().map_err(|e| StudioError::Other(format!("Invalid from address: {e}")))?)
        .to(to_email.parse::<Mailbox>().map_err(|e| StudioError::Other(format!("Invalid to address: {e}")))?)
        .subject("RevealUI — SMTP Test")
        .body("This is a test email from RevealUI Studio.".to_string())
        .map_err(|e| StudioError::Other(format!("Build email: {e}")))?;

    let creds = Credentials::new(user, pass);
    let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay(&host)
        .map_err(|e| StudioError::Network(format!("SMTP relay: {e}")))?
        .port(port)
        .credentials(creds)
        .build();

    mailer
        .send(email)
        .await
        .map_err(|e| StudioError::Network(format!("SMTP send failed: {e}")))?;

    Ok(true)
}
```

**Prerequisite:** Add `lettre` crate to Cargo.toml (codebase uses `rustls`, not `native-tls`):
```bash
cd apps/studio/src-tauri && cargo add lettre --features tokio1-rustls-tls
```
This step MUST happen before the Rust code compiles.

- [ ] **Step 4: Register command in lib.rs**

Add `smtp_send_test` to the `generate_handler!` macro in `apps/studio/src-tauri/src/lib.rs`.

- [ ] **Step 5: Add TS bridge function**

Add to `apps/studio/src/lib/deploy.ts`:

```typescript
export async function smtpSendTest(
  host: string,
  port: number,
  user: string,
  pass: string,
  toEmail: string,
): Promise<boolean> {
  if (!isTauri()) return true;
  return tauriInvoke<boolean>('smtp_send_test', { host, port, user, pass, toEmail });
}
```

- [ ] **Step 6: Wire SMTP test in StepEmail**

Modify `apps/studio/src/components/deploy/StepEmail.tsx`:

```typescript
import { resendSendTest, smtpSendTest } from '../../lib/deploy';

// In handleSendTest():
if (provider === 'resend') {
  await resendSendTest(resendApiKey, testEmail);
} else {
  await smtpSendTest(
    smtpHost,
    Number.parseInt(smtpPort, 10) || 587,
    smtpUser,
    smtpPass,
    testEmail,
  );
}
```

- [ ] **Step 7: Run tests**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepEmail.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src-tauri/src/commands/deploy/email.rs apps/studio/src-tauri/src/lib.rs apps/studio/src/lib/deploy.ts apps/studio/src/components/deploy/StepEmail.tsx apps/studio/src/__tests__/components/StepEmail.test.tsx
git commit -m "feat(studio): add SMTP test command and wire in StepEmail"
```

---

### Task 4: StepSecrets — Add Tests (No Functional Changes)

The `StepSecrets` component is functionally complete — generates 3 secrets via `Promise.all`. It just needs test coverage.

**Files:**
- Create: `apps/studio/src/__tests__/components/StepSecrets.test.tsx`

- [ ] **Step 1: Write tests**

```typescript
// apps/studio/src/__tests__/components/StepSecrets.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepSecrets from '../../components/deploy/StepSecrets';
import type { WizardData } from '../../types';

vi.mock('../../lib/deploy', () => ({
  generateSecret: vi.fn().mockResolvedValue('a'.repeat(48)),
  generateKek: vi.fn().mockResolvedValue('b'.repeat(64)),
}));

// ... MOCK_DATA ...

describe('StepSecrets', () => {
  it('renders title and secret descriptions', () => {
    render(<StepSecrets data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Generate Secrets')).toBeInTheDocument();
    expect(screen.getByText('REVEALUI_SECRET')).toBeInTheDocument();
    expect(screen.getByText('REVEALUI_KEK')).toBeInTheDocument();
    expect(screen.getByText('REVEALUI_CRON_SECRET')).toBeInTheDocument();
  });

  it('shows Generate button when secrets not yet generated', () => {
    render(<StepSecrets data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Generate All Secrets')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('generates all 3 secrets on button click', async () => {
    const onUpdateData = vi.fn();
    render(<StepSecrets data={MOCK_DATA} onUpdateData={onUpdateData} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Generate All Secrets'));

    await waitFor(() => {
      expect(onUpdateData).toHaveBeenCalledWith({
        revealuiSecret: expect.any(String),
        revealuiKek: expect.any(String),
        cronSecret: expect.any(String),
      });
    });
  });

  it('shows green checkmarks after generation', async () => {
    const onUpdateData = vi.fn();
    render(<StepSecrets data={MOCK_DATA} onUpdateData={onUpdateData} onNext={vi.fn()} />);

    fireEvent.click(screen.getByText('Generate All Secrets'));

    await waitFor(() => {
      const generated = screen.getAllByText('Generated');
      expect(generated).toHaveLength(3);
    });
  });

  it('auto-detects already-generated secrets from data', () => {
    const dataWithSecrets = {
      ...MOCK_DATA,
      revealuiSecret: 'already-set',
      revealuiKek: 'already-set-kek',
      cronSecret: 'already-set-cron',
    };

    render(<StepSecrets data={dataWithSecrets} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    // Should show Generated labels, not the Generate button
    expect(screen.queryByText('Generate All Secrets')).not.toBeInTheDocument();
    expect(screen.getByText('Next')).not.toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepSecrets.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/__tests__/components/StepSecrets.test.tsx
git commit -m "test(studio): add StepSecrets component tests"
```

---

## Chunk 2: Steps 5-9 (Blob, Domain, Deploy, Verify) + Integration

### Task 5: StepBlob — Add Token Validation

The current `StepBlob` just saves the token without validation. Add a Vercel API call to validate the blob token has read+write permissions.

**Files:**
- Modify: `apps/studio/src-tauri/src/commands/deploy/vercel.rs` (add `vercel_validate_blob_token`)
- Modify: `apps/studio/src-tauri/src/lib.rs` (register command)
- Modify: `apps/studio/src/lib/deploy.ts` (add bridge)
- Modify: `apps/studio/src/components/deploy/StepBlob.tsx` (call validation)
- Create: `apps/studio/src/__tests__/components/StepBlob.test.tsx`

- [ ] **Step 1: Write test for StepBlob**

```typescript
// apps/studio/src/__tests__/components/StepBlob.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepBlob from '../../components/deploy/StepBlob';
import type { WizardData } from '../../types';

vi.mock('../../lib/deploy', () => ({
  vercelValidateBlobToken: vi.fn().mockResolvedValue(true),
}));

// ... MOCK_DATA ...

describe('StepBlob', () => {
  it('renders token input and instructions', () => {
    render(<StepBlob data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Blob Storage')).toBeInTheDocument();
  });

  it('disables Save button when token is empty', () => {
    render(<StepBlob data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Save Token')).toBeDisabled();
  });

  it('disables Next until token is saved', () => {
    render(<StepBlob data={MOCK_DATA} onUpdateData={vi.fn()} onNext={vi.fn()} />);

    expect(screen.getByText('Next')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepBlob.test.tsx`
Expected: PASS (basic rendering tests)

- [ ] **Step 3: Add Rust blob validation command**

Add to `apps/studio/src-tauri/src/commands/deploy/vercel.rs`:

```rust
/// Validate a Vercel Blob token by listing blobs (requires read permission).
/// Rejects 403 — that means the token lacks read+write permissions.
#[tauri::command]
pub async fn vercel_validate_blob_token(token: String) -> Result<bool, StudioError> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://blob.vercel-storage.com?limit=1")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    // Only 200 means the token has valid read permissions
    // 403 = insufficient permissions (reject), 401 = invalid token (reject)
    Ok(resp.status().is_success())
}
```

- [ ] **Step 4: Register command + add TS bridge**

Register `vercel_validate_blob_token` in `lib.rs`.

Add to `deploy.ts`:
```typescript
export async function vercelValidateBlobToken(token: string): Promise<boolean> {
  if (!isTauri()) return true;
  return tauriInvoke<boolean>('vercel_validate_blob_token', { token });
}
```

- [ ] **Step 5: Wire validation in StepBlob**

Modify `StepBlob.tsx` — change `handleSave()` to call validation before saving:

```typescript
import { vercelValidateBlobToken } from '../../lib/deploy';

async function handleSave() {
  const trimmed = blobToken.trim();
  if (!trimmed) return;

  setLoading(true);
  setError(null);

  try {
    const valid = await vercelValidateBlobToken(trimmed);
    if (!valid) {
      setError('Invalid blob token — check the token has read+write permissions.');
      return;
    }
    onUpdateData({ blobToken: trimmed });
    setSaved(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to validate token');
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepBlob.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/studio/src-tauri/src/commands/deploy/vercel.rs apps/studio/src-tauri/src/lib.rs apps/studio/src/lib/deploy.ts apps/studio/src/components/deploy/StepBlob.tsx apps/studio/src/__tests__/components/StepBlob.test.tsx
git commit -m "feat(studio): validate Vercel Blob token before saving in StepBlob"
```

---

### Task 6: StepDomain — Add Missing Fields

The spec includes `REVEALUI_SIGNUP_WHITELIST`, `REVEALUI_BRAND_PRIMARY_COLOR`, and `REVEALUI_BRAND_LOGO_URL`. The current component has domain, signupOpen, and brandName but is missing the other three.

**Files:**
- Modify: `apps/studio/src/types.ts` (add fields to `WizardData`)
- Modify: `apps/studio/src/components/deploy/DeployWizard.tsx` (update `EMPTY_WIZARD_DATA`)
- Modify: `apps/studio/src/components/deploy/StepDomain.tsx` (add inputs)
- Modify: `apps/studio/src/components/deploy/StepDeploy.tsx` (add new vars to env matrix)
- Existing test: `apps/studio/src/__tests__/components/StepDomain.test.tsx` (update)

- [ ] **Step 1: Add types**

Add to `WizardData` in `apps/studio/src/types.ts`:

```typescript
signupWhitelist?: string;
brandColor?: string;
brandLogo?: string;
```

- [ ] **Step 2: Update EMPTY_WIZARD_DATA in DeployWizard.tsx**

Add empty defaults for the 3 new fields.

- [ ] **Step 3: Add inputs to StepDomain**

Add 3 new `<Input>` fields in `StepDomain.tsx`:

```tsx
<Input
  id="signup-whitelist"
  label="Signup Whitelist"
  hint="optional — comma-separated emails"
  placeholder="user@example.com, admin@example.com"
  value={signupWhitelist}
  onChange={(e) => { setSignupWhitelist(e.target.value); setSaved(false); }}
  disabled={saved}
/>

<Input
  id="brand-color"
  label="Brand Color"
  hint="optional — hex color"
  placeholder="#ea580c"
  value={brandColor}
  onChange={(e) => { setBrandColor(e.target.value); setSaved(false); }}
  disabled={saved}
/>

<Input
  id="brand-logo"
  label="Brand Logo URL"
  hint="optional — URL to logo image"
  placeholder="https://example.com/logo.png"
  value={brandLogo}
  onChange={(e) => { setBrandLogo(e.target.value); setSaved(false); }}
  disabled={saved}
/>
```

Update `handleSave()` to include the new fields in `onUpdateData()`:

```typescript
async function handleSave() {
  if (!cleanDomain) return;
  setSaving(true);
  setError(null);
  try {
    onUpdateData({
      domain: cleanDomain,
      signupOpen,
      brandName: brandName.trim() || undefined,
      signupWhitelist: signupWhitelist.trim() || undefined,
      brandColor: brandColor.trim() || undefined,
      brandLogo: brandLogo.trim() || undefined,
    });
    await onUpdateConfig({
      deploy: {
        ...config.deploy,
        domain: cleanDomain,
        supabaseEnabled: config.deploy?.supabaseEnabled ?? false,
      },
    });
    setSaved(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to save configuration');
  } finally {
    setSaving(false);
  }
}
```

- [ ] **Step 4: Add env vars to StepDeploy**

In `buildApiEnvVars()` in `StepDeploy.tsx`, add:

```typescript
if (data.signupWhitelist) {
  vars.REVEALUI_SIGNUP_WHITELIST = data.signupWhitelist;
}
if (data.brandColor) {
  vars.REVEALUI_BRAND_PRIMARY_COLOR = data.brandColor;
}
if (data.brandLogo) {
  vars.REVEALUI_BRAND_LOGO_URL = data.brandLogo;
}
```

- [ ] **Step 5: Update existing StepDomain test**

Add test for new fields in `apps/studio/src/__tests__/components/StepDomain.test.tsx`:

```typescript
it('renders optional brand fields', () => {
  render(
    <StepDomain
      config={MOCK_CONFIG}
      data={MOCK_DATA}
      onUpdateData={vi.fn()}
      onUpdateConfig={vi.fn()}
      onNext={vi.fn()}
    />,
  );

  expect(screen.getByPlaceholderText('#ea580c')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('https://example.com/logo.png')).toBeInTheDocument();
});
```

- [ ] **Step 6: Run tests**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepDomain.test.tsx`
Expected: PASS

- [ ] **Step 7: Run typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/types.ts apps/studio/src/components/deploy/DeployWizard.tsx apps/studio/src/components/deploy/StepDomain.tsx apps/studio/src/components/deploy/StepDeploy.tsx apps/studio/src/__tests__/components/StepDomain.test.tsx
git commit -m "feat(studio): add signup whitelist, brand color, brand logo to StepDomain"
```

---

### Task 7: StepDeploy — Complete Env Var Matrix + Tests

The env var builders in `StepDeploy.tsx` are mostly complete but need:
1. Supabase vars when `supabaseEnabled` is true (API + CMS)
2. CMS needs email vars for password reset emails
3. CMS needs `REVEALUI_SIGNUP_OPEN` (already exists in `buildApiEnvVars` — do NOT duplicate there)

**Files:**
- Modify: `apps/studio/src/components/deploy/StepDeploy.tsx`
- Create: `apps/studio/src/__tests__/components/StepDeploy.test.tsx`

- [ ] **Step 1: Write test for env var builders**

```typescript
// apps/studio/src/__tests__/components/StepDeploy.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepDeploy from '../../components/deploy/StepDeploy';
import type { StudioConfig, WizardData } from '../../types';

vi.mock('../../lib/deploy', () => ({
  vercelSetEnv: vi.fn().mockResolvedValue(undefined),
  vercelDeploy: vi.fn().mockResolvedValue('mock-deploy-id'),
  vercelGetDeployment: vi.fn().mockResolvedValue({ id: 'mock', url: 'test.vercel.app', state: 'READY', createdAt: 0 }),
}));

const MOCK_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: false,
  completedSteps: [],
  deploy: {
    supabaseEnabled: false,
    apps: { api: 'prj_api', cms: 'prj_cms', marketing: 'prj_mktg' },
  },
};

// ... MOCK_DATA with all fields populated ...

describe('StepDeploy', () => {
  it('renders 3 app cards', () => {
    render(<StepDeploy config={MOCK_CONFIG} data={MOCK_DATA} onNext={vi.fn()} />);

    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('CMS')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('shows Deploy All button', () => {
    render(<StepDeploy config={MOCK_CONFIG} data={MOCK_DATA} onNext={vi.fn()} />);

    expect(screen.getByText('Deploy All')).toBeInTheDocument();
  });

  it('disables Next until all apps are ready', () => {
    render(<StepDeploy config={MOCK_CONFIG} data={MOCK_DATA} onNext={vi.fn()} />);

    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('shows error if project IDs are missing', async () => {
    const configNoApps: StudioConfig = {
      intent: 'deploy',
      setupComplete: false,
      completedSteps: [],
      deploy: { supabaseEnabled: false },
    };

    render(<StepDeploy config={configNoApps} data={MOCK_DATA} onNext={vi.fn()} />);

    // fireEvent is already imported at the top of the file
    fireEvent.click(screen.getByText('Deploy All'));

    expect(await screen.findByText(/Missing project IDs/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepDeploy.test.tsx`
Expected: PASS (rendering tests should pass)

- [ ] **Step 3: Add missing env vars to builders**

Modify `buildApiEnvVars()` in `StepDeploy.tsx`:

```typescript
// Add Supabase vars (when enabled — passed via WizardData)
if (data.supabaseUrl) {
  vars.NEXT_PUBLIC_SUPABASE_URL = data.supabaseUrl;
}
if (data.supabaseAnonKey) {
  vars.NEXT_PUBLIC_SUPABASE_ANON_KEY = data.supabaseAnonKey;
}
if (data.supabaseServiceKey) {
  vars.SUPABASE_SERVICE_ROLE_KEY = data.supabaseServiceKey;
}
```

Modify `buildCmsEnvVars()`:

```typescript
// Add email vars for CMS password reset
if (data.emailProvider === 'resend' && data.resendApiKey) {
  vars.RESEND_API_KEY = data.resendApiKey;
} else if (data.emailProvider === 'smtp') {
  if (data.smtpHost) vars.SMTP_HOST = data.smtpHost;
  if (data.smtpPort) vars.SMTP_PORT = data.smtpPort;
  if (data.smtpUser) vars.SMTP_USER = data.smtpUser;
  if (data.smtpPass) vars.SMTP_PASS = data.smtpPass;
}

// Add signup control
vars.REVEALUI_SIGNUP_OPEN = String(data.signupOpen);

// Supabase for CMS AI features
if (data.supabaseUrl) {
  vars.NEXT_PUBLIC_SUPABASE_URL = data.supabaseUrl;
  if (data.supabaseAnonKey) vars.NEXT_PUBLIC_SUPABASE_ANON_KEY = data.supabaseAnonKey;
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepDeploy.test.tsx && pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/components/deploy/StepDeploy.tsx apps/studio/src/__tests__/components/StepDeploy.test.tsx
git commit -m "feat(studio): complete env var matrix — add Supabase, CMS email, signup control vars"
```

---

### Task 8: StepVerify — Add Email Delivery Check + Tests

Add an email delivery check to the verification step (spec item: "Email delivery works"). Add admin password validation (spec: >= 12 chars). Add cron job verification note (spec step 8 lines 146-149: verify `vercel.json` has cron entries). The other spec checks (webhook test, CORS test, cookie cross-subdomain, signup flow) require browser interaction or complex integration — mark them as manual verification items displayed to the user.

**Files:**
- Modify: `apps/studio/src/components/deploy/StepVerify.tsx`
- Create: `apps/studio/src/__tests__/components/StepVerify.test.tsx`

- [ ] **Step 1: Write test for StepVerify**

```typescript
// apps/studio/src/__tests__/components/StepVerify.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StepVerify from '../../components/deploy/StepVerify';
import type { StudioConfig, WizardData } from '../../types';

vi.mock('../../lib/deploy', () => ({
  healthCheck: vi.fn().mockResolvedValue(200),
  vercelSetEnv: vi.fn().mockResolvedValue(undefined),
  resendSendTest: vi.fn().mockResolvedValue(true),
}));

const MOCK_CONFIG: StudioConfig = {
  intent: 'deploy',
  setupComplete: false,
  completedSteps: [],
  deploy: { supabaseEnabled: false, apps: { api: 'prj_api' } },
};

// ... MOCK_DATA with domain: 'test.com' ...

describe('StepVerify', () => {
  it('renders admin inputs and check rows', () => {
    render(<StepVerify config={MOCK_CONFIG} data={MOCK_DATA} onComplete={vi.fn()} />);

    expect(screen.getByText('Bootstrap & Verify')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('API Health')).toBeInTheDocument();
    expect(screen.getByText('CMS')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
    expect(screen.getByText('Database (via API)')).toBeInTheDocument();
    expect(screen.getByText('Email Delivery')).toBeInTheDocument();
  });

  it('disables Run Checks when admin fields are empty', () => {
    render(<StepVerify config={MOCK_CONFIG} data={MOCK_DATA} onComplete={vi.fn()} />);

    expect(screen.getByText('Run Checks')).toBeDisabled();
  });

  it('disables Complete Setup until all checks pass', () => {
    render(<StepVerify config={MOCK_CONFIG} data={MOCK_DATA} onComplete={vi.fn()} />);

    expect(screen.getByText('Complete Setup')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails (new "Email Delivery" check row)**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepVerify.test.tsx`
Expected: FAIL on "Email Delivery" text not found

- [ ] **Step 3: Add email delivery check to StepVerify**

Modify `StepVerify.tsx`:

1. Import `resendSendTest` from deploy bridge
2. Add 5th check: `{ label: 'Email Delivery', status: 'idle' }`
3. After health checks, run email test:

```typescript
// After the health check Promise.allSettled:
try {
  updateCheck(4, { status: 'checking' });
  if (data.emailProvider === 'resend' && data.resendApiKey) {
    await resendSendTest(data.resendApiKey, trimmedEmail);
    updateCheck(4, { status: 'pass', detail: 'Test email sent' });
  } else {
    // For SMTP, we already validated during StepEmail — mark as pass
    updateCheck(4, { status: 'pass', detail: 'Validated in email step' });
  }
} catch {
  updateCheck(4, { status: 'fail', detail: 'Email delivery failed' });
}
```

4. Add admin password validation (spec says >= 12 chars):

```typescript
// In the admin password input handler or before running checks:
if (trimmedPassword.length < 12) {
  setError('Admin password must be at least 12 characters');
  return;
}
```

5. Add a cron job verification note (spec step 8 lines 146-149):

```tsx
{/* After automated checks, before manual section */}
<div className="rounded-md border border-yellow-700/50 bg-yellow-900/20 p-3 text-xs text-yellow-400">
  <p className="font-medium">Cron jobs</p>
  <p className="mt-1 text-yellow-500">
    Verify that <code>apps/api/vercel.json</code> contains cron entries for{' '}
    <code>support-renewal-check</code> (daily) and <code>report-agent-overage</code> (every 5 min).
    Vercel reads cron config from the file at deploy time.
  </p>
</div>
```

6. Add a "Manual verification" section below the automated checks:

```tsx
<div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 text-xs text-neutral-500">
  <p className="mb-1 font-medium text-neutral-400">Manual verification (after setup):</p>
  <ul className="list-inside list-disc flex flex-col gap-0.5">
    <li>Stripe webhook test event fires and is received</li>
    <li>CORS allows CMS → API requests</li>
    <li>Session cookie works cross-subdomain</li>
    <li>Signup flow works end-to-end</li>
  </ul>
</div>
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter studio test -- --run src/__tests__/components/StepVerify.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/components/deploy/StepVerify.tsx apps/studio/src/__tests__/components/StepVerify.test.tsx
git commit -m "feat(studio): add email delivery check + manual verification hints to StepVerify"
```

---

### Task 9: Deploy Bridge Tests + Full Test Run

Add tests for the IPC bridge functions in `deploy.ts` to ensure mock fallbacks work correctly in browser mode.

**Files:**
- Create: `apps/studio/src/__tests__/lib/deploy.test.ts`

- [ ] **Step 1: Write deploy bridge tests**

```typescript
// apps/studio/src/__tests__/lib/deploy.test.ts
import { describe, expect, it } from 'vitest';
import {
  generateKek,
  generateRsaKeypair,
  generateSecret,
  healthCheck,
  neonTestConnection,
  resendSendTest,
  runDbMigrate,
  runDbSeed,
  smtpSendTest,
  stripeCatalogSync,
  stripeRunKeys,
  stripeRunSeed,
  stripeValidateKeys,
  vercelCreateProject,
  vercelDeploy,
  vercelGetDeployment,
  vercelSetEnv,
  vercelValidateBlobToken,
  vercelValidateToken,
} from '../../lib/deploy';

// These tests run in browser mode (no __TAURI_INTERNALS__) — verify mock fallbacks

describe('deploy bridge (browser mocks)', () => {
  it('vercelValidateToken returns empty array', async () => {
    expect(await vercelValidateToken('token')).toEqual([]);
  });

  it('vercelCreateProject returns mock project', async () => {
    const result = await vercelCreateProject('token', 'test', 'nextjs');
    expect(result).toEqual({ id: 'mock-test', name: 'test', framework: 'nextjs' });
  });

  it('vercelSetEnv resolves without error', async () => {
    await expect(vercelSetEnv('t', 'p', 'k', 'v')).resolves.toBeUndefined();
  });

  it('vercelDeploy returns mock ID', async () => {
    expect(await vercelDeploy('t', 'p')).toBe('mock-deploy-id');
  });

  it('vercelGetDeployment returns READY state', async () => {
    const result = await vercelGetDeployment('t', 'dep-1');
    expect(result.state).toBe('READY');
  });

  it('neonTestConnection returns mock timestamp', async () => {
    expect(await neonTestConnection('postgres://...')).toContain('mock');
  });

  it('stripeValidateKeys returns true', async () => {
    expect(await stripeValidateKeys('sk_test')).toBe(true);
  });

  it('generateSecret returns string of requested length', async () => {
    expect(await generateSecret(48)).toHaveLength(48);
  });

  it('generateKek returns 64-char string', async () => {
    expect(await generateKek()).toHaveLength(64);
  });

  it('generateRsaKeypair returns tuple', async () => {
    const [priv, pub] = await generateRsaKeypair();
    expect(priv).toBeTruthy();
    expect(pub).toBeTruthy();
  });

  it('healthCheck returns 200', async () => {
    expect(await healthCheck('https://example.com')).toBe(200);
  });

  it('smtpSendTest returns true', async () => {
    expect(await smtpSendTest('smtp.example.com', 587, 'user', 'pass', 'test@example.com')).toBe(true);
  });

  it('vercelValidateBlobToken returns true', async () => {
    expect(await vercelValidateBlobToken('vercel_blob_token')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm --filter studio test -- --run src/__tests__/lib/deploy.test.ts`
Expected: PASS

- [ ] **Step 3: Run ALL studio tests**

Run: `pnpm --filter studio test`
Expected: PASS (all existing + new tests green)

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/__tests__/lib/deploy.test.ts
git commit -m "test(studio): add deploy IPC bridge tests for browser mock fallbacks"
```

---

### Task 10: Final Gate + Cleanup

- [ ] **Step 1: Run full studio tests**

Run: `pnpm --filter studio test`
Expected: PASS

- [ ] **Step 2: Run studio typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `pnpm --filter studio lint`
Expected: PASS (or auto-fix with `pnpm --filter studio lint:fix`)

- [ ] **Step 4: Run quick gate**

Run: `pnpm gate:quick`
Expected: PASS

- [ ] **Step 5: Final commit if any lint fixes**

```bash
git add -A apps/studio/
git commit -m "chore(studio): lint fixes from deploy wizard gap-closing"
```
