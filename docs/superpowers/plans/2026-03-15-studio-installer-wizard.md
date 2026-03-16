# Studio Installer & Setup Wizard — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing `apps/studio` Tauri 2 app into a unified installer + companion that handles both self-hosting deployment (Vercel + managed DB) and developer environment setup.

**Architecture:** Extend the existing Tauri 2 + React 19 app. Add a Rust-managed persistent config system, an intent-selection screen as the new first-run gate, and a 9-step deploy wizard. Deploy commands are standalone Tauri commands (NOT in the PlatformOps trait) since deploy is pure HTTP with no platform variance. PlatformOps remains for dev-flow operations that differ by OS.

**Tech Stack:** Tauri 2, React 19, TypeScript 5.9, Tailwind v4, Rust. reqwest (HTTP), rand (secrets), rsa (key generation). Vercel API, Neon API, Stripe CLI, Resend API.

**Spec:** `docs/superpowers/specs/2026-03-15-studio-installer-wizard-design.md`

---

## File Structure

### New Rust Files (src-tauri/src/)

| File | Responsibility |
|------|----------------|
| `config.rs` | `StudioConfig` struct, JSON file I/O at `~/.config/revealui-studio/config.json` |
| `commands/config.rs` | `get_config`, `set_config`, `reset_config` Tauri commands |
| `commands/deploy/mod.rs` | Module exports for all deploy commands |
| `commands/deploy/vercel.rs` | `vercel_validate_token`, `vercel_list_projects`, `vercel_create_project`, `vercel_set_env`, `vercel_deploy`, `vercel_get_deployments` |
| `commands/deploy/database.rs` | `neon_test_connection`, `run_db_migrate`, `run_db_seed` |
| `commands/deploy/stripe.rs` | `stripe_validate_keys`, `stripe_run_seed`, `stripe_run_keys` |
| `commands/deploy/email.rs` | `resend_send_test` |
| `commands/deploy/secrets.rs` | `generate_secret`, `generate_kek`, `generate_rsa_keypair` |
| `commands/deploy/health.rs` | `health_check` |

### New React Files (src/)

| File | Responsibility |
|------|----------------|
| `lib/config.ts` | IPC bridge for config commands + mock data |
| `lib/deploy.ts` | IPC bridge for all deploy commands + mock data |
| `hooks/use-config.ts` | Load/save config, track intent |
| `hooks/use-deploy-wizard.ts` | Wizard step state, navigation, completion tracking |
| `components/intent/IntentScreen.tsx` | Deploy vs Develop selection (first-run gate) |
| `components/deploy/DeployWizard.tsx` | Wizard container with step navigation bar |
| `components/deploy/WizardStep.tsx` | Shared step layout (title, description, status, actions) |
| `components/deploy/StepVercel.tsx` | Step 1: Connect Vercel |
| `components/deploy/StepDatabase.tsx` | Step 2: Provision Database |
| `components/deploy/StepStripe.tsx` | Step 3: Connect Stripe |
| `components/deploy/StepEmail.tsx` | Step 4: Connect Email |
| `components/deploy/StepBlob.tsx` | Step 5: Connect Blob Storage |
| `components/deploy/StepSecrets.tsx` | Step 6: Generate Secrets |
| `components/deploy/StepDomain.tsx` | Step 7: Configure Domain & CORS |
| `components/deploy/StepDeploy.tsx` | Step 8: Deploy |
| `components/deploy/StepVerify.tsx` | Step 9: Bootstrap & Verify |
| `components/dashboard/DeployDashboard.tsx` | Deployment health dashboard (deploy intent) |

### Modified Files

| File | Changes |
|------|---------|
| `src-tauri/Cargo.toml` | Add `reqwest`, `rand`, `rsa`, `hex` dependencies |
| `src-tauri/src/lib.rs` | Import + register new commands, manage config state |
| `src-tauri/src/commands/mod.rs` | Add `pub mod config;` and `pub mod deploy;` |
| `src/App.tsx` | Replace `isSetupComplete()` with config-based intent routing |
| `src/types.ts` | Add `StudioConfig`, `DeployState`, `VercelProject`, etc. |
| `src/lib/invoke.ts` | Add mock data entries for new commands |
| `src/components/layout/Sidebar.tsx` | Add deploy dashboard nav item (deploy intent) |
| `packages/config/src/schema.ts` | Add missing env vars (KEK, cron secret, license keys, email) |

---

## Chunk 1: Foundation

### Task 1: Extend env schema (prerequisites)

The spec requires `REVEALUI_KEK`, `REVEALUI_CRON_SECRET`, license keys, and email vars to be in the config schema before the wizard can validate them.

**Files:**
- Modify: `packages/config/src/schema.ts`
- Test: `packages/config/src/__tests__/schema.test.ts` (if exists, otherwise verify with typecheck)

- [ ] **Step 1: Read current schema to identify insertion point**

Run: `grep -n 'REVEALUI_SECRET' packages/config/src/schema.ts`

- [ ] **Step 2: Write test for new schema fields**

Create a test that validates the new env vars parse correctly:

**Note:** The test code depends on how the schema is exported. Read `packages/config/src/schema.ts` first to find the schema object name and its `.safeParse()` / `.parse()` method. Write real assertions — for example:

```typescript
import { describe, expect, it } from 'vitest';
// Import the schema — exact name depends on what schema.ts exports
// e.g.: import { envSchema } from '../schema';

describe('extended schema fields', () => {
  it('accepts valid REVEALUI_KEK (64 hex chars)', () => {
    const result = envSchema.safeParse({ /* required base fields + */ REVEALUI_KEK: 'a'.repeat(64) });
    expect(result.success).toBe(true);
  });

  it('rejects REVEALUI_KEK with wrong length', () => {
    const result = envSchema.safeParse({ /* required base fields + */ REVEALUI_KEK: 'a'.repeat(48) });
    expect(result.success).toBe(false);
  });

  it('accepts optional RESEND_API_KEY', () => {
    const result = envSchema.safeParse({ /* required base fields only */ });
    expect(result.success).toBe(true); // RESEND_API_KEY is optional
  });
});
```

The implementing agent must read the schema file to determine the exact export name and required base fields.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @revealui/config test -- --run`
Expected: FAIL — fields don't exist in schema yet

- [ ] **Step 4: Add new fields to schema**

Add to the Zod schema object in `packages/config/src/schema.ts`:

```typescript
// Field-level encryption key — exactly 64 hex characters (32 bytes / 256 bits)
REVEALUI_KEK: z.string().regex(/^[0-9a-f]{64}$/i, 'Must be exactly 64 hex characters').optional(),

// Cron endpoint authentication
REVEALUI_CRON_SECRET: z.string().min(32).optional(),

// License key signing (RSA-2048 PEM)
REVEALUI_LICENSE_PRIVATE_KEY: z.string().optional(),
REVEALUI_LICENSE_PUBLIC_KEY: z.string().optional(),

// Email provider — Resend or SMTP
RESEND_API_KEY: z.string().optional(),
SMTP_HOST: z.string().optional(),
SMTP_PORT: z.coerce.number().optional(),
SMTP_USER: z.string().optional(),
SMTP_PASS: z.string().optional(),

// Admin bootstrap
REVEALUI_ADMIN_EMAIL: z.string().email().optional(),
REVEALUI_ADMIN_PASSWORD: z.string().min(12).optional(),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @revealui/config test -- --run`
Expected: PASS

- [ ] **Step 6: Typecheck the config package**

Run: `pnpm --filter @revealui/config typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/config/src/schema.ts packages/config/src/__tests__/
git commit -m "feat(config): add KEK, cron secret, license keys, and email vars to schema"
```

---

### Task 2: Rust config module

Persistent config replaces `localStorage`. File lives at `~/.config/revealui-studio/config.json`.

**Files:**
- Create: `apps/studio/src-tauri/src/config.rs`

- [ ] **Step 1: Create the config module**

```rust
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioConfig {
    pub intent: Option<String>, // "deploy" | "develop" | null
    pub setup_complete: bool,
    pub completed_steps: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deploy: Option<DeployConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub develop: Option<DevelopConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployConfig {
    pub vercel_token: Option<String>,
    pub vercel_team_id: Option<String>,
    pub domain: Option<String>,
    pub apps: Option<DeployApps>,
    pub neon_project_id: Option<String>,
    pub supabase_enabled: bool,
    pub email_provider: Option<String>, // "resend" | "smtp"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployApps {
    pub api: Option<String>,
    pub cms: Option<String>,
    pub marketing: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DevelopConfig {
    pub repo_path: Option<String>,
    pub wsl_distro: Option<String>,
    pub nix_installed: bool,
}

impl Default for StudioConfig {
    fn default() -> Self {
        Self {
            intent: None,
            setup_complete: false,
            completed_steps: Vec::new(),
            deploy: None,
            develop: None,
        }
    }
}

pub struct ConfigState {
    pub config: Mutex<StudioConfig>,
}

impl ConfigState {
    pub fn new() -> Self {
        let config = load_config().unwrap_or_default();
        Self {
            config: Mutex::new(config),
        }
    }
}

fn config_path() -> PathBuf {
    let base = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("revealui-studio").join("config.json")
}

fn load_config() -> Result<StudioConfig, String> {
    let path = config_path();
    if !path.exists() {
        return Ok(StudioConfig::default());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

pub fn save_config(config: &StudioConfig) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 2: Add `mod config;` to lib.rs**

In `apps/studio/src-tauri/src/lib.rs`, add `mod config;` after the existing module declarations.

- [ ] **Step 3: Verify Rust compiles**

Run: `cd apps/studio/src-tauri && cargo check`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src-tauri/src/config.rs apps/studio/src-tauri/src/lib.rs
git commit -m "feat(studio): add persistent config module (StudioConfig)"
```

---

### Task 3: Config Tauri commands

**Files:**
- Create: `apps/studio/src-tauri/src/commands/config.rs`
- Modify: `apps/studio/src-tauri/src/commands/mod.rs`
- Modify: `apps/studio/src-tauri/src/lib.rs`

- [ ] **Step 1: Create config commands**

```rust
use crate::config::{save_config, ConfigState, StudioConfig};
use tauri::State;

#[tauri::command]
pub fn get_config(state: State<ConfigState>) -> Result<StudioConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn set_config(state: State<ConfigState>, config: StudioConfig) -> Result<(), String> {
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = config.clone();
    save_config(&config)?;
    Ok(())
}

#[tauri::command]
pub fn reset_config(state: State<ConfigState>) -> Result<(), String> {
    let default_config = StudioConfig::default();
    let mut current = state.config.lock().map_err(|e| e.to_string())?;
    *current = default_config.clone();
    save_config(&default_config)?;
    Ok(())
}
```

- [ ] **Step 2: Register in commands/mod.rs**

Add `pub mod config;` to `apps/studio/src-tauri/src/commands/mod.rs`.

- [ ] **Step 3: Register commands + state in lib.rs**

In `apps/studio/src-tauri/src/lib.rs`:
- Add `use config::ConfigState;` to imports
- Add `.manage(ConfigState::new())` to the builder chain
- Add `commands::config::get_config`, `commands::config::set_config`, `commands::config::reset_config` to `generate_handler![]`

- [ ] **Step 4: Verify Rust compiles**

Run: `cd apps/studio/src-tauri && cargo check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src-tauri/src/commands/config.rs apps/studio/src-tauri/src/commands/mod.rs apps/studio/src-tauri/src/lib.rs
git commit -m "feat(studio): add get_config/set_config/reset_config Tauri commands"
```

---

### Task 4: TypeScript types for config + deploy

**Files:**
- Modify: `apps/studio/src/types.ts`

- [ ] **Step 1: Add config and deploy types**

Append to `apps/studio/src/types.ts`:

```typescript
/** Persistent config — mirrors Rust StudioConfig */
export interface StudioConfig {
  intent: 'deploy' | 'develop' | null;
  setupComplete: boolean;
  completedSteps: string[];
  deploy?: DeployConfig;
  develop?: DevelopConfig;
}

export interface DeployConfig {
  vercelToken?: string;
  vercelTeamId?: string;
  domain?: string;
  apps?: { api?: string; cms?: string; marketing?: string };
  neonProjectId?: string;
  supabaseEnabled: boolean;
  emailProvider?: 'resend' | 'smtp';
}

export interface DevelopConfig {
  repoPath?: string;
  wslDistro?: string;
  nixInstalled: boolean;
}

/** Vercel API types */
export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
}

export interface VercelDeployment {
  id: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  createdAt: number;
}

/** Deploy wizard step IDs */
export type DeployStep =
  | 'vercel'
  | 'database'
  | 'stripe'
  | 'email'
  | 'blob'
  | 'secrets'
  | 'domain'
  | 'deploy'
  | 'verify';

/** Health check result */
export interface HealthCheckResult {
  url: string;
  status: number | null;
  ok: boolean;
  error?: string;
}

/** Accumulated wizard data — survives across steps via parent state.
 * Each step reads/writes fields it owns. StepDeploy reads all of them
 * to push env vars to Vercel. */
export interface WizardData {
  // Step 1
  vercelToken: string;
  vercelProjects: { api: string; cms: string; marketing: string };
  // Step 2
  postgresUrl: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceKey?: string;
  // Step 3
  stripeSecretKey: string;
  stripePublishableKey: string;
  stripeWebhookSecret: string;
  stripePriceIds: { pro: string; max: string; enterprise: string };
  licensePrivateKey: string;
  licensePublicKey: string;
  // Step 4
  emailProvider: 'resend' | 'smtp';
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  // Step 5
  blobToken: string;
  // Step 6
  revealuiSecret: string;
  revealuiKek: string;
  cronSecret: string;
  // Step 7
  domain: string;
  signupOpen: boolean;
  brandName?: string;
}
```

**Note:** `WizardData` is NOT persisted — it lives as React state in `DeployWizard` and is passed to each step. Sensitive values (tokens, keys) only persist in Vercel env vars, never on disk. `StudioConfig` stores non-sensitive metadata (intent, domain, project IDs, completed steps).

- [ ] **Step 2: Update Page type**

Change the existing `Page` type to add `'deploy'`:

```typescript
export type Page =
  | 'dashboard'
  | 'vault'
  | 'infrastructure'
  | 'sync'
  | 'tunnel'
  | 'terminal'
  | 'setup'
  | 'deploy';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/types.ts
git commit -m "feat(studio): add TypeScript types for config, deploy wizard, and Vercel API"
```

---

### Task 5: Config IPC bridge

**Files:**
- Create: `apps/studio/src/lib/config.ts`
- Modify: `apps/studio/src/lib/invoke.ts` (add mock data for config commands)

- [ ] **Step 1: Create config bridge**

```typescript
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { StudioConfig } from '../types';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const DEFAULT_CONFIG: StudioConfig = {
  intent: null,
  setupComplete: false,
  completedSteps: [],
};

let cachedConfig: StudioConfig | null = null;

export async function getConfig(): Promise<StudioConfig> {
  if (!isTauri()) {
    return cachedConfig ?? { ...DEFAULT_CONFIG };
  }
  const config = await tauriInvoke<StudioConfig>('get_config');
  cachedConfig = config;
  return config;
}

export async function setConfig(config: StudioConfig): Promise<void> {
  cachedConfig = config;
  if (!isTauri()) return;
  await tauriInvoke<void>('set_config', { config });
}

export async function resetConfig(): Promise<void> {
  cachedConfig = null;
  if (!isTauri()) return;
  await tauriInvoke<void>('reset_config');
}

/** Mark a deploy step as completed */
export async function completeStep(stepId: string): Promise<StudioConfig> {
  const config = await getConfig();
  if (!config.completedSteps.includes(stepId)) {
    config.completedSteps.push(stepId);
  }
  await setConfig(config);
  return config;
}

/** Check if a deploy step is completed */
export function isStepComplete(config: StudioConfig, stepId: string): boolean {
  return config.completedSteps.includes(stepId);
}
```

- [ ] **Step 2: Add mock data to invoke.ts**

Add to the `MOCK_DATA` object in `apps/studio/src/lib/invoke.ts`:

```typescript
get_config: {
  intent: null,
  setupComplete: false,
  completedSteps: [],
} satisfies StudioConfig,
set_config: undefined,
reset_config: undefined,
```

And add `StudioConfig` to the type imports at the top of the file.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/lib/config.ts apps/studio/src/lib/invoke.ts
git commit -m "feat(studio): add config IPC bridge with browser-mode fallback"
```

---

### Task 6: useConfig hook

**Files:**
- Create: `apps/studio/src/hooks/use-config.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useEffect, useState } from 'react';
import { getConfig, setConfig } from '../lib/config';
import type { StudioConfig } from '../types';

interface UseConfigReturn {
  config: StudioConfig | null;
  loading: boolean;
  error: string | null;
  updateConfig: (updates: Partial<StudioConfig>) => Promise<void>;
  setIntent: (intent: 'deploy' | 'develop') => Promise<void>;
}

// Note: No useCallback/useMemo per React Compiler policy.
// React 19 Compiler handles memoization automatically.

export function useConfig(): UseConfigReturn {
  const [config, setConfigState] = useState<StudioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConfig()
      .then(setConfigState)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const updateConfig = async (updates: Partial<StudioConfig>) => {
    if (!config) return;
    const updated = { ...config, ...updates };
    try {
      await setConfig(updated);
      setConfigState(updated); // Update after successful save
    } catch (e) {
      setError(String(e));
    }
  };

  const setIntent = async (intent: 'deploy' | 'develop') => {
    await updateConfig({ intent });
  };

  return { config, loading, error, updateConfig, setIntent };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/hooks/use-config.ts
git commit -m "feat(studio): add useConfig hook for persistent config management"
```

---

## Chunk 2: Intent Screen + Deploy Wizard Shell

### Task 7: Intent screen component

The intent screen replaces the `SetupWizard` modal as the first-run gate. Two cards: Deploy and Develop.

**Files:**
- Create: `apps/studio/src/components/intent/IntentScreen.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState } from 'react';
import Button from '../ui/Button';

interface IntentScreenProps {
  onSelect: (intent: 'deploy' | 'develop') => void;
}

export default function IntentScreen({ onSelect }: IntentScreenProps) {
  const [selected, setSelected] = useState<'deploy' | 'develop' | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950">
      <div className="w-full max-w-2xl px-8">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-600 text-2xl font-bold text-white">
            R
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome to RevealUI Studio</h1>
          <p className="mt-2 text-neutral-400">How would you like to use RevealUI?</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <button
            type="button"
            onClick={() => setSelected('deploy')}
            className={`rounded-xl border-2 p-6 text-left transition ${
              selected === 'deploy'
                ? 'border-orange-500 bg-neutral-800'
                : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
            }`}
          >
            <div className="mb-2 text-2xl">&#x1F680;</div>
            <h2 className="text-lg font-semibold text-white">Deploy</h2>
            <p className="mt-1 text-sm text-neutral-400">
              I want to run RevealUI for my business. Set up Vercel, database, Stripe, and go live.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelected('develop')}
            className={`rounded-xl border-2 p-6 text-left transition ${
              selected === 'develop'
                ? 'border-orange-500 bg-neutral-800'
                : 'border-neutral-700 bg-neutral-900 hover:border-neutral-500'
            }`}
          >
            <div className="mb-2 text-2xl">&#x1F6E0;&#xFE0F;</div>
            <h2 className="text-lg font-semibold text-white">Develop</h2>
            <p className="mt-1 text-sm text-neutral-400">
              I want to contribute to RevealUI. Set up the dev environment with WSL, Nix, and tools.
            </p>
          </button>
        </div>

        <div className="mt-8 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            disabled={!selected}
            onClick={() => selected && onSelect(selected)}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/components/intent/IntentScreen.tsx
git commit -m "feat(studio): add IntentScreen component (deploy vs develop selection)"
```

---

### Task 8: Deploy wizard container + step navigation

**Files:**
- Create: `apps/studio/src/components/deploy/DeployWizard.tsx`
- Create: `apps/studio/src/components/deploy/WizardStep.tsx`
- Create: `apps/studio/src/hooks/use-deploy-wizard.ts`

- [ ] **Step 1: Create useDeployWizard hook**

```typescript
import { useState } from 'react';
import { completeStep, isStepComplete } from '../lib/config';
import type { DeployStep, StudioConfig } from '../types';

// No useCallback — React Compiler policy.

const DEPLOY_STEPS: { id: DeployStep; label: string }[] = [
  { id: 'vercel', label: 'Connect Vercel' },
  { id: 'database', label: 'Provision Database' },
  { id: 'stripe', label: 'Connect Stripe' },
  { id: 'email', label: 'Connect Email' },
  { id: 'blob', label: 'Blob Storage' },
  { id: 'secrets', label: 'Generate Secrets' },
  { id: 'domain', label: 'Domain & CORS' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'verify', label: 'Verify' },
];

export function useDeployWizard(config: StudioConfig | null) {
  const [currentStep, setCurrentStep] = useState<number>(() => {
    if (!config) return 0;
    const idx = DEPLOY_STEPS.findIndex((s) => !isStepComplete(config, s.id));
    return idx === -1 ? 0 : idx;
  });

  const step = DEPLOY_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === DEPLOY_STEPS.length - 1;

  const markComplete = async () => {
    if (step) {
      await completeStep(step.id);
    }
  };

  const next = async () => {
    await markComplete();
    if (!isLast) setCurrentStep((i) => i + 1);
  };

  const back = () => {
    if (!isFirst) setCurrentStep((i) => i - 1);
  };

  const goTo = (index: number) => {
    setCurrentStep(index);
  };

  return {
    steps: DEPLOY_STEPS,
    currentStep,
    step,
    isFirst,
    isLast,
    next,
    back,
    goTo,
    markComplete,
    isStepDone: (id: DeployStep) => config ? isStepComplete(config, id) : false,
  };
}
```

- [ ] **Step 2: Create WizardStep layout component**

```tsx
import type { ReactNode } from 'react';
import ErrorAlert from '../ui/ErrorAlert';

interface WizardStepProps {
  title: string;
  description: string;
  children: ReactNode;
  error?: string | null;
}

export default function WizardStep({ title, description, children, error }: WizardStepProps) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-neutral-400">{description}</p>
      </div>
      {error && <ErrorAlert message={error} />}
      <div className="flex-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create DeployWizard container**

```tsx
import { useState } from 'react';
import { useConfig } from '../../hooks/use-config';
import { useDeployWizard } from '../../hooks/use-deploy-wizard';
import type { WizardData } from '../../types';
import Button from '../ui/Button';
import StepVercel from './StepVercel';
import StepDatabase from './StepDatabase';
import StepStripe from './StepStripe';
import StepEmail from './StepEmail';
import StepBlob from './StepBlob';
import StepSecrets from './StepSecrets';
import StepDomain from './StepDomain';
import StepDeploy from './StepDeploy';
import StepVerify from './StepVerify';

interface DeployWizardProps {
  onComplete: () => void;
}

const EMPTY_WIZARD_DATA: WizardData = {
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

export default function DeployWizard({ onComplete }: DeployWizardProps) {
  const { config, updateConfig } = useConfig();
  // WizardData accumulates sensitive values across steps.
  // Lives in React state only — never persisted to disk.
  const [data, setData] = useState<WizardData>(EMPTY_WIZARD_DATA);

  // Hooks must be called unconditionally (Rules of Hooks).
  // useDeployWizard handles null config internally.
  const wizard = useDeployWizard(config);

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const stepComponents: Record<string, React.ReactNode> = {
    vercel: <StepVercel config={config} data={data} onUpdateData={updateData} onUpdateConfig={updateConfig} onNext={wizard.next} />,
    database: <StepDatabase config={config} data={data} onUpdateData={updateData} onNext={wizard.next} />,
    stripe: <StepStripe config={config} data={data} onUpdateData={updateData} onNext={wizard.next} />,
    email: <StepEmail config={config} data={data} onUpdateData={updateData} onUpdateConfig={updateConfig} onNext={wizard.next} />,
    blob: <StepBlob data={data} onUpdateData={updateData} onNext={wizard.next} />,
    secrets: <StepSecrets data={data} onUpdateData={updateData} onNext={wizard.next} />,
    domain: <StepDomain config={config} data={data} onUpdateData={updateData} onUpdateConfig={updateConfig} onNext={wizard.next} />,
    deploy: <StepDeploy config={config} data={data} onNext={wizard.next} />,
    verify: <StepVerify config={config} data={data} onComplete={onComplete} />,
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-neutral-950">
      {/* Step sidebar */}
      <div className="w-64 border-r border-neutral-800 bg-neutral-900 p-4">
        <h1 className="mb-6 text-lg font-bold text-white">Deploy RevealUI</h1>
        <nav className="space-y-1">
          {wizard.steps.map((s, i) => {
            const done = wizard.isStepDone(s.id);
            const active = i === wizard.currentStep;
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => wizard.goTo(i)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  active
                    ? 'bg-neutral-800 text-white'
                    : done
                      ? 'text-green-400 hover:bg-neutral-800'
                      : 'text-neutral-500 hover:bg-neutral-800'
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs">
                  {done ? '\u2713' : i + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Step content */}
      <div className="flex flex-1 flex-col p-8">
        <div className="flex-1 overflow-y-auto">
          {wizard.step && stepComponents[wizard.step.id]}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex justify-between border-t border-neutral-800 pt-4">
          <Button variant="ghost" disabled={wizard.isFirst} onClick={wizard.back}>
            Back
          </Button>
          <div className="text-sm text-neutral-500">
            Step {wizard.currentStep + 1} of {wizard.steps.length}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Note:** This component references step components (StepVercel, StepDatabase, etc.) that will be created in Chunks 4 and 5. For now, create placeholder files so the code compiles. Each placeholder exports a component that renders its step name.

- [ ] **Step 4: Create placeholder step components**

For each of the 9 step files (`StepVercel.tsx`, `StepDatabase.tsx`, `StepStripe.tsx`, `StepEmail.tsx`, `StepBlob.tsx`, `StepSecrets.tsx`, `StepDomain.tsx`, `StepDeploy.tsx`, `StepVerify.tsx`), create a placeholder:

```tsx
import type { StudioConfig } from '../../types';
import WizardStep from './WizardStep';
import Button from '../ui/Button';

interface StepProps {
  config: StudioConfig;
  onUpdate: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

export default function StepVercel({ onNext }: StepProps) {
  return (
    <WizardStep title="Connect Vercel" description="Link your Vercel account to deploy RevealUI.">
      <p className="text-neutral-400">Coming soon...</p>
      <Button variant="primary" onClick={onNext} className="mt-4">
        Next
      </Button>
    </WizardStep>
  );
}
```

Adjust the title/description for each step. `StepVerify` uses `onComplete` instead of `onNext`.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/hooks/use-deploy-wizard.ts apps/studio/src/components/deploy/
git commit -m "feat(studio): add deploy wizard container with step navigation and placeholders"
```

---

### Task 9: Integrate intent + wizard into App.tsx

**Files:**
- Modify: `apps/studio/src/App.tsx`

- [ ] **Step 1: Replace localStorage-based first-run with config-based routing**

Replace the entire `App.tsx` content:

```tsx
import { useState } from 'react';
import Dashboard from './components/dashboard/Dashboard';
import DeployWizard from './components/deploy/DeployWizard';
import IntentScreen from './components/intent/IntentScreen';
import InfrastructurePanel from './components/infrastructure/InfrastructurePanel';
import AppShell from './components/layout/AppShell';
import SetupPage from './components/setup/SetupPage';
import SetupWizard from './components/setup/SetupWizard';
import SyncPanel from './components/sync/SyncPanel';
import TerminalPanel from './components/terminal/TerminalPanel';
import TunnelPanel from './components/tunnel/TunnelPanel';
import VaultPanel from './components/vault/VaultPanel';
import { useConfig } from './hooks/use-config';
import type { Page } from './types';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const { config, loading, setIntent, updateConfig } = useConfig();

  // Loading config from disk
  if (loading || !config) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  // No intent selected — show intent screen
  if (!config.intent) {
    return (
      <IntentScreen
        onSelect={async (intent) => {
          await setIntent(intent);
        }}
      />
    );
  }

  // Deploy intent — show deploy wizard if not complete
  if (config.intent === 'deploy' && !config.setupComplete) {
    return (
      <DeployWizard
        onComplete={async () => {
          await updateConfig({ setupComplete: true });
        }}
      />
    );
  }

  // Develop intent — show setup wizard if not complete
  if (config.intent === 'develop' && !config.setupComplete) {
    return (
      <>
        <AppShell currentPage={page} onNavigate={setPage}>
          {page === 'dashboard' && <Dashboard />}
          {page === 'vault' && <VaultPanel />}
          {page === 'infrastructure' && <InfrastructurePanel />}
          {page === 'sync' && <SyncPanel />}
          {page === 'tunnel' && <TunnelPanel />}
          {page === 'terminal' && <TerminalPanel />}
          {page === 'setup' && <SetupPage />}
        </AppShell>
        <SetupWizard
          onClose={async () => {
            await updateConfig({ setupComplete: true });
          }}
        />
      </>
    );
  }

  // Setup complete — normal app
  return (
    <AppShell currentPage={page} onNavigate={setPage}>
      {page === 'dashboard' && <Dashboard />}
      {page === 'vault' && <VaultPanel />}
      {page === 'infrastructure' && <InfrastructurePanel />}
      {page === 'sync' && <SyncPanel />}
      {page === 'tunnel' && <TunnelPanel />}
      {page === 'terminal' && <TerminalPanel />}
      {page === 'setup' && <SetupPage />}
    </AppShell>
  );
}
```

- [ ] **Step 2: Remove the old `isSetupComplete` import**

The old `import { isSetupComplete } from './hooks/use-setup'` is no longer needed in App.tsx. Verify it's removed.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/App.tsx
git commit -m "feat(studio): integrate intent screen + deploy wizard into app routing"
```

---

## Chunk 3: Deploy Wizard Rust Commands

### Task 10: Add HTTP + crypto dependencies to Cargo.toml

**Files:**
- Modify: `apps/studio/src-tauri/Cargo.toml`

- [ ] **Step 1: Add dependencies**

Add to `[dependencies]` in `apps/studio/src-tauri/Cargo.toml`:

```toml
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
rand = "0.9"
hex = "0.4"
rsa = { version = "0.9", features = ["pem"] }
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/studio/src-tauri && cargo check`
Expected: PASS (may take a while to download/compile new deps)

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src-tauri/Cargo.toml
git commit -m "chore(studio): add reqwest, rand, hex, rsa dependencies"
```

---

### Task 11: Deploy commands — secrets module

Start with the simplest commands: crypto-random secret generation.

**Files:**
- Create: `apps/studio/src-tauri/src/commands/deploy/mod.rs`
- Create: `apps/studio/src-tauri/src/commands/deploy/secrets.rs`

- [ ] **Step 1: Create deploy module**

```rust
// apps/studio/src-tauri/src/commands/deploy/mod.rs
pub mod secrets;
```

- [ ] **Step 2: Register deploy module in commands/mod.rs**

Add `pub mod deploy;` to `apps/studio/src-tauri/src/commands/mod.rs`.

- [ ] **Step 3: Create secrets commands**

```rust
use rand::Rng;
use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey, LineEnding};
use rsa::RsaPrivateKey;

/// Generate a crypto-random alphanumeric string of the given length.
#[tauri::command]
pub fn generate_secret(length: usize) -> Result<String, String> {
    let charset = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::rng();
    let secret: String = (0..length)
        .map(|_| {
            let idx = rng.random_range(0..charset.len());
            charset[idx] as char
        })
        .collect();
    Ok(secret)
}

/// Generate a 64-character hex string (32 bytes) for REVEALUI_KEK.
#[tauri::command]
pub fn generate_kek() -> Result<String, String> {
    let mut bytes = [0u8; 32];
    rand::rng().fill(&mut bytes);
    Ok(hex::encode(bytes))
}

/// Generate an RSA-2048 key pair. Returns (private_pem, public_pem).
#[tauri::command]
pub fn generate_rsa_keypair() -> Result<(String, String), String> {
    let mut rng = rand::rng();
    let private_key = RsaPrivateKey::new(&mut rng, 2048).map_err(|e| e.to_string())?;
    let public_key = private_key.to_public_key();

    let private_pem = private_key
        .to_pkcs8_pem(LineEnding::LF)
        .map_err(|e| e.to_string())?;
    let public_pem = public_key
        .to_public_key_pem(LineEnding::LF)
        .map_err(|e| e.to_string())?;

    Ok((private_pem.to_string(), public_pem))
}
```

- [ ] **Step 4: Register commands in lib.rs**

Add to `generate_handler![]`:
```rust
commands::deploy::secrets::generate_secret,
commands::deploy::secrets::generate_kek,
commands::deploy::secrets::generate_rsa_keypair,
```

And add `use commands::deploy;` to the import block.

- [ ] **Step 5: Verify compiles**

Run: `cd apps/studio/src-tauri && cargo check`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src-tauri/src/commands/deploy/ apps/studio/src-tauri/src/commands/mod.rs apps/studio/src-tauri/src/lib.rs
git commit -m "feat(studio): add generate_secret, generate_kek, generate_rsa_keypair commands"
```

---

### Task 12: Deploy commands — Vercel API

**Files:**
- Create: `apps/studio/src-tauri/src/commands/deploy/vercel.rs`
- Modify: `apps/studio/src-tauri/src/commands/deploy/mod.rs`

- [ ] **Step 1: Create Vercel commands**

```rust
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct VercelProject {
    pub id: String,
    pub name: String,
    pub framework: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct VercelDeployment {
    pub uid: String,
    pub url: Option<String>,
    pub state: Option<String>,
    #[serde(rename = "created")]
    pub created_at: Option<u64>,
}

/// Create a Vercel project linked to a GitHub repo.
#[tauri::command]
pub async fn vercel_create_project(
    token: String,
    name: String,
    framework: String,
    root_directory: Option<String>,
) -> Result<VercelProject, String> {
    let client = Client::new();
    let mut body = serde_json::json!({
        "name": name,
        "framework": framework,
    });
    if let Some(root) = root_directory {
        body["rootDirectory"] = serde_json::Value::String(root);
    }
    let resp = client
        .post("https://api.vercel.com/v10/projects")
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Failed to create project: {}", text));
    }

    resp.json::<VercelProject>().await.map_err(|e| e.to_string())
}

/// Validate a Vercel API token by listing projects.
#[tauri::command]
pub async fn vercel_validate_token(token: String) -> Result<Vec<VercelProject>, String> {
    let client = Client::new();
    let resp = client
        .get("https://api.vercel.com/v9/projects")
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Vercel API error: {}", resp.status()));
    }

    #[derive(Deserialize)]
    struct ListResponse {
        projects: Vec<VercelProject>,
    }

    let body: ListResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(body.projects)
}

/// Push environment variables to a Vercel project.
#[tauri::command]
pub async fn vercel_set_env(
    token: String,
    project_id: String,
    key: String,
    value: String,
    target: Vec<String>,  // ["production", "preview", "development"]
) -> Result<(), String> {
    let client = Client::new();
    let url = format!("https://api.vercel.com/v10/projects/{}/env", project_id);

    let body = serde_json::json!({
        "key": key,
        "value": value,
        "type": "encrypted",
        "target": target,
    });

    let resp = client
        .post(&url)
        .bearer_auth(&token)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // 409 = env var already exists, update instead
    if resp.status().as_u16() == 409 {
        let patch_url = format!("{}/{}", url, key);
        let patch_resp = client
            .patch(&patch_url)
            .bearer_auth(&token)
            .json(&serde_json::json!({ "value": value, "target": target }))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !patch_resp.status().is_success() {
            return Err(format!("Vercel env update failed: {}", patch_resp.status()));
        }
    } else if !resp.status().is_success() {
        return Err(format!("Vercel env create failed: {}", resp.status()));
    }

    Ok(())
}

/// Trigger a deployment via Vercel API.
#[tauri::command]
pub async fn vercel_deploy(
    token: String,
    project_id: String,
) -> Result<String, String> {
    let client = Client::new();
    let resp = client
        .post("https://api.vercel.com/v13/deployments")
        .bearer_auth(&token)
        .json(&serde_json::json!({
            "name": project_id,
            "project": project_id,
            "target": "production",
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Deploy failed: {}", text));
    }

    #[derive(Deserialize)]
    struct DeployResponse {
        id: String,
    }

    let body: DeployResponse = resp.json().await.map_err(|e| e.to_string())?;
    Ok(body.id)
}

/// Check deployment status.
#[tauri::command]
pub async fn vercel_get_deployment(
    token: String,
    deployment_id: String,
) -> Result<VercelDeployment, String> {
    let client = Client::new();
    let url = format!("https://api.vercel.com/v13/deployments/{}", deployment_id);
    let resp = client
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Vercel API error: {}", resp.status()));
    }

    let deploy: VercelDeployment = resp.json().await.map_err(|e| e.to_string())?;
    Ok(deploy)
}
```

- [ ] **Step 2: Add `pub mod vercel;` to deploy/mod.rs**

- [ ] **Step 3: Register commands in lib.rs**

Add to `generate_handler![]`:
```rust
commands::deploy::vercel::vercel_validate_token,
commands::deploy::vercel::vercel_set_env,
commands::deploy::vercel::vercel_deploy,
commands::deploy::vercel::vercel_get_deployment,
```

- [ ] **Step 4: Verify compiles**

Run: `cd apps/studio/src-tauri && cargo check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src-tauri/src/commands/deploy/vercel.rs apps/studio/src-tauri/src/commands/deploy/mod.rs apps/studio/src-tauri/src/lib.rs
git commit -m "feat(studio): add Vercel API commands (validate, env, deploy, status)"
```

---

### Task 13: Deploy commands — database, Stripe, email, health

**Files:**
- Create: `apps/studio/src-tauri/src/commands/deploy/database.rs`
- Create: `apps/studio/src-tauri/src/commands/deploy/stripe.rs`
- Create: `apps/studio/src-tauri/src/commands/deploy/email.rs`
- Create: `apps/studio/src-tauri/src/commands/deploy/health.rs`
- Modify: `apps/studio/src-tauri/src/commands/deploy/mod.rs`

- [ ] **Step 1: Create database commands**

```rust
use std::process::Command;

/// Test a Neon connection string by running a query via psql.
#[tauri::command]
pub async fn neon_test_connection(connection_string: String) -> Result<String, String> {
    let output = Command::new("psql")
        .arg(&connection_string)
        .arg("-c")
        .arg("SELECT NOW()")
        .output()
        .map_err(|e| format!("Failed to run psql: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Run Drizzle migrations.
#[tauri::command]
pub async fn run_db_migrate(repo_path: String) -> Result<String, String> {
    let output = Command::new("pnpm")
        .arg("--filter")
        .arg("@revealui/db")
        .arg("db:migrate")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run db:migrate: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Run database seed (mandatory — creates home page).
#[tauri::command]
pub async fn run_db_seed(repo_path: String) -> Result<String, String> {
    let output = Command::new("pnpm")
        .arg("db:seed")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run db:seed: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
```

- [ ] **Step 2: Create Stripe commands**

```rust
use std::process::Command;

/// Validate Stripe API keys by making a test call.
#[tauri::command]
pub async fn stripe_validate_keys(secret_key: String) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get("https://api.stripe.com/v1/balance")
        .basic_auth(&secret_key, None::<&str>)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok(resp.status().is_success())
}

/// Run stripe:seed script (creates products, prices, webhook, billing portal).
#[tauri::command]
pub async fn stripe_run_seed(repo_path: String) -> Result<String, String> {
    let output = Command::new("pnpm")
        .arg("stripe:seed")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run stripe:seed: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Run stripe:keys -- --write (generates RSA key pair for license signing).
#[tauri::command]
pub async fn stripe_run_keys(repo_path: String) -> Result<String, String> {
    let output = Command::new("pnpm")
        .arg("stripe:keys")
        .arg("--")
        .arg("--write")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run stripe:keys: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Run billing:catalog:sync (populates billing_catalog table from Stripe products).
/// Must run after stripe:seed and requires database connection.
#[tauri::command]
pub async fn stripe_catalog_sync(repo_path: String) -> Result<String, String> {
    let output = Command::new("pnpm")
        .arg("billing:catalog:sync")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run billing:catalog:sync: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}
```

- [ ] **Step 3: Create email commands**

```rust
/// Send a test email via Resend API.
#[tauri::command]
pub async fn resend_send_test(api_key: String, to_email: String) -> Result<bool, String> {
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.resend.com/emails")
        .bearer_auth(&api_key)
        .json(&serde_json::json!({
            "from": "RevealUI Studio <noreply@resend.dev>",
            "to": [to_email],
            "subject": "RevealUI Studio — Email Test",
            "text": "Your email configuration is working. This is a test from RevealUI Studio setup wizard."
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resp.status().is_success() {
        Ok(true)
    } else {
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Resend API error: {}", text))
    }
}
```

- [ ] **Step 4: Create health check command**

```rust
/// HTTP health check — returns status code or error.
#[tauri::command]
pub async fn health_check(url: String) -> Result<u16, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Connection failed: {}", e))?;

    Ok(resp.status().as_u16())
}
```

- [ ] **Step 5: Update deploy/mod.rs**

```rust
pub mod database;
pub mod email;
pub mod health;
pub mod secrets;
pub mod stripe;
pub mod vercel;
```

- [ ] **Step 6: Register all new commands in lib.rs**

Add to `generate_handler![]`:
```rust
commands::deploy::database::neon_test_connection,
commands::deploy::database::run_db_migrate,
commands::deploy::database::run_db_seed,
commands::deploy::stripe::stripe_validate_keys,
commands::deploy::stripe::stripe_run_seed,
commands::deploy::stripe::stripe_run_keys,
commands::deploy::email::resend_send_test,
commands::deploy::health::health_check,
```

- [ ] **Step 7: Verify compiles**

Run: `cd apps/studio/src-tauri && cargo check`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src-tauri/src/commands/deploy/ apps/studio/src-tauri/src/lib.rs
git commit -m "feat(studio): add database, stripe, email, and health check deploy commands"
```

---

## Chunk 4: Deploy Wizard Frontend — Steps 1-5

### Task 14: Deploy IPC bridge

**Files:**
- Create: `apps/studio/src/lib/deploy.ts`

- [ ] **Step 1: Create deploy invoke wrappers**

```typescript
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { VercelDeployment, VercelProject } from '../types';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// ── Vercel ─────────────────────────────────────────────────────────────────

export async function vercelValidateToken(token: string): Promise<VercelProject[]> {
  if (!isTauri()) return [];
  return tauriInvoke<VercelProject[]>('vercel_validate_token', { token });
}

export async function vercelSetEnv(
  token: string,
  projectId: string,
  key: string,
  value: string,
  target: string[] = ['production', 'preview', 'development'],
): Promise<void> {
  if (!isTauri()) return;
  return tauriInvoke<void>('vercel_set_env', { token, projectId, key, value, target });
}

export async function vercelDeploy(token: string, projectId: string): Promise<string> {
  if (!isTauri()) return 'mock-deploy-id';
  return tauriInvoke<string>('vercel_deploy', { token, projectId });
}

export async function vercelGetDeployment(
  token: string,
  deploymentId: string,
): Promise<VercelDeployment> {
  if (!isTauri()) {
    return { id: deploymentId, url: 'mock.vercel.app', state: 'READY', createdAt: Date.now() };
  }
  return tauriInvoke<VercelDeployment>('vercel_get_deployment', { token, deploymentId });
}

// ── Database ───────────────────────────────────────────────────────────────

export async function neonTestConnection(connectionString: string): Promise<string> {
  if (!isTauri()) return 'NOW() = 2026-03-15 (mock)';
  return tauriInvoke<string>('neon_test_connection', { connectionString });
}

export async function runDbMigrate(repoPath: string): Promise<string> {
  if (!isTauri()) return 'Migrations complete (mock)';
  return tauriInvoke<string>('run_db_migrate', { repoPath });
}

export async function runDbSeed(repoPath: string): Promise<string> {
  if (!isTauri()) return 'Seed complete (mock)';
  return tauriInvoke<string>('run_db_seed', { repoPath });
}

// ── Stripe ─────────────────────────────────────────────────────────────────

export async function stripeValidateKeys(secretKey: string): Promise<boolean> {
  if (!isTauri()) return true;
  return tauriInvoke<boolean>('stripe_validate_keys', { secretKey });
}

export async function stripeRunSeed(repoPath: string): Promise<string> {
  if (!isTauri()) return 'Stripe seed complete (mock)';
  return tauriInvoke<string>('stripe_run_seed', { repoPath });
}

export async function stripeRunKeys(repoPath: string): Promise<string> {
  if (!isTauri()) return 'Keys generated (mock)';
  return tauriInvoke<string>('stripe_run_keys', { repoPath });
}

export async function stripeCatalogSync(repoPath: string): Promise<string> {
  if (!isTauri()) return 'Catalog synced (mock)';
  return tauriInvoke<string>('stripe_catalog_sync', { repoPath });
}

export async function vercelCreateProject(
  token: string,
  name: string,
  framework: string,
  rootDirectory?: string,
): Promise<VercelProject> {
  if (!isTauri()) return { id: `mock-${name}`, name, framework };
  return tauriInvoke<VercelProject>('vercel_create_project', { token, name, framework, rootDirectory: rootDirectory ?? null });
}

// ── Email ──────────────────────────────────────────────────────────────────

export async function resendSendTest(apiKey: string, toEmail: string): Promise<boolean> {
  if (!isTauri()) return true;
  return tauriInvoke<boolean>('resend_send_test', { apiKey, toEmail });
}

// ── Secrets ────────────────────────────────────────────────────────────────

export async function generateSecret(length: number): Promise<string> {
  if (!isTauri()) return 'x'.repeat(length);
  return tauriInvoke<string>('generate_secret', { length });
}

export async function generateKek(): Promise<string> {
  if (!isTauri()) return 'a'.repeat(64);
  return tauriInvoke<string>('generate_kek');
}

export async function generateRsaKeypair(): Promise<[string, string]> {
  if (!isTauri()) return ['MOCK_PRIVATE_KEY_PEM', 'MOCK_PUBLIC_KEY_PEM'];
  return tauriInvoke<[string, string]>('generate_rsa_keypair');
}

// ── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck(url: string): Promise<number> {
  if (!isTauri()) return 200;
  return tauriInvoke<number>('health_check', { url });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/lib/deploy.ts
git commit -m "feat(studio): add deploy IPC bridge with all command wrappers"
```

---

### Task 15: Step 1 — Connect Vercel

**Files:**
- Replace placeholder: `apps/studio/src/components/deploy/StepVercel.tsx`

- [ ] **Step 1: Implement StepVercel**

```tsx
import { useCallback, useState } from 'react';
import { vercelValidateToken } from '../../lib/deploy';
import type { StudioConfig, VercelProject } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepVercelProps {
  config: StudioConfig;
  onUpdate: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

export default function StepVercel({ config, onUpdate, onNext }: StepVercelProps) {
  const [token, setToken] = useState(config.deploy?.vercelToken ?? '');
  const [projects, setProjects] = useState<VercelProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);

  const validate = useCallback(async () => {
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await vercelValidateToken(token.trim());
      setProjects(result);
      setValidated(true);
      await onUpdate({
        deploy: {
          ...config.deploy,
          vercelToken: token.trim(),
          supabaseEnabled: config.deploy?.supabaseEnabled ?? false,
        },
      });
    } catch (e) {
      setError(String(e));
      setValidated(false);
    } finally {
      setLoading(false);
    }
  }, [token, config, onUpdate]);

  return (
    <WizardStep
      title="Connect Vercel"
      description="Paste your Vercel API token from vercel.com/account/tokens"
      error={error}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-300" htmlFor="vercel-token">
            Vercel API Token
          </label>
          <Input
            id="vercel-token"
            type="password"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setValidated(false);
            }}
            placeholder="Enter your Vercel API token"
          />
        </div>

        <Button variant="secondary" onClick={validate} loading={loading} disabled={!token.trim()}>
          Validate Token
        </Button>

        {validated && (
          <div className="rounded-lg border border-green-800 bg-green-900/20 p-4">
            <p className="text-sm text-green-400">
              Token valid. Found {projects.length} project{projects.length !== 1 ? 's' : ''}.
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="primary" disabled={!validated} onClick={onNext}>
            Next
          </Button>
        </div>
      </div>
    </WizardStep>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/components/deploy/StepVercel.tsx
git commit -m "feat(studio): implement Step 1 — Connect Vercel"
```

---

### Task 16: Step 2 — Provision Database

**Files:**
- Replace placeholder: `apps/studio/src/components/deploy/StepDatabase.tsx`

- [ ] **Step 1: Implement StepDatabase**

```tsx
import { useCallback, useState } from 'react';
import { neonTestConnection, runDbMigrate, runDbSeed } from '../../lib/deploy';
import type { StudioConfig } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepDatabaseProps {
  config: StudioConfig;
  onUpdate: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

type Phase = 'input' | 'testing' | 'migrating' | 'seeding' | 'done';

export default function StepDatabase({ config, onUpdate, onNext }: StepDatabaseProps) {
  const [connectionString, setConnectionString] = useState('');
  const [supabaseEnabled, setSupabaseEnabled] = useState(config.deploy?.supabaseEnabled ?? false);
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseServiceKey, setSupabaseServiceKey] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);

  const provision = useCallback(async () => {
    setError(null);
    try {
      setPhase('testing');
      await neonTestConnection(connectionString);

      setPhase('migrating');
      await runDbMigrate('.');

      setPhase('seeding');
      await runDbSeed('.');

      setPhase('done');
      await onUpdate({
        deploy: {
          ...config.deploy,
          supabaseEnabled,
          vercelToken: config.deploy?.vercelToken,
        },
      });
    } catch (e) {
      setError(String(e));
      setPhase('input');
    }
  }, [connectionString, supabaseEnabled, config, onUpdate]);

  const phaseLabel: Record<Phase, string> = {
    input: '',
    testing: 'Testing connection...',
    migrating: 'Running migrations...',
    seeding: 'Seeding database (creating home page)...',
    done: 'Database ready!',
  };

  return (
    <WizardStep
      title="Provision Database"
      description="Connect to NeonDB. Migrations and seed data will run automatically."
      error={error}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-300" htmlFor="postgres-url">
            POSTGRES_URL (NeonDB connection string)
          </label>
          <Input
            id="postgres-url"
            type="password"
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
            placeholder="postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb"
            disabled={phase !== 'input'}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="supabase-enabled"
            checked={supabaseEnabled}
            onChange={(e) => setSupabaseEnabled(e.target.checked)}
            className="rounded border-neutral-600"
            disabled={phase !== 'input'}
          />
          <label className="text-sm text-neutral-300" htmlFor="supabase-enabled">
            Enable AI features (requires Supabase)
          </label>
        </div>

        {supabaseEnabled && (
          <div className="space-y-3 rounded-lg border border-neutral-700 p-4">
            <Input
              placeholder="NEXT_PUBLIC_SUPABASE_URL"
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              disabled={phase !== 'input'}
            />
            <Input
              type="password"
              placeholder="NEXT_PUBLIC_SUPABASE_ANON_KEY"
              value={supabaseAnonKey}
              onChange={(e) => setSupabaseAnonKey(e.target.value)}
              disabled={phase !== 'input'}
            />
            <Input
              type="password"
              placeholder="SUPABASE_SERVICE_ROLE_KEY"
              value={supabaseServiceKey}
              onChange={(e) => setSupabaseServiceKey(e.target.value)}
              disabled={phase !== 'input'}
            />
          </div>
        )}

        {phase !== 'input' && (
          <div className={`rounded-lg border p-4 ${phase === 'done' ? 'border-green-800 bg-green-900/20' : 'border-neutral-700 bg-neutral-800'}`}>
            <p className={`text-sm ${phase === 'done' ? 'text-green-400' : 'text-neutral-300'}`}>
              {phaseLabel[phase]}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {phase === 'input' && (
            <Button
              variant="primary"
              onClick={provision}
              disabled={!connectionString.trim()}
            >
              Connect & Migrate
            </Button>
          )}
          {phase === 'done' && (
            <Button variant="primary" onClick={onNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </WizardStep>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/components/deploy/StepDatabase.tsx
git commit -m "feat(studio): implement Step 2 — Provision Database"
```

---

### Task 17: Step 3 — Connect Stripe

**Files:**
- Replace placeholder: `apps/studio/src/components/deploy/StepStripe.tsx`

- [ ] **Step 1: Implement StepStripe**

```tsx
import { useCallback, useState } from 'react';
import { stripeValidateKeys, stripeRunKeys, stripeRunSeed } from '../../lib/deploy';
import type { StudioConfig } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepStripeProps {
  config: StudioConfig;
  onUpdate: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

type Phase = 'input' | 'validating' | 'generating-keys' | 'seeding' | 'done';

export default function StepStripe({ config, onUpdate, onNext }: StepStripeProps) {
  const [secretKey, setSecretKey] = useState('');
  const [publishableKey, setPublishableKey] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    try {
      setPhase('validating');
      const valid = await stripeValidateKeys(secretKey);
      if (!valid) throw new Error('Invalid Stripe secret key');

      setPhase('generating-keys');
      await stripeRunKeys('.');

      setPhase('seeding');
      await stripeRunSeed('.');

      setPhase('done');
    } catch (e) {
      setError(String(e));
      setPhase('input');
    }
  }, [secretKey]);

  const phaseLabel: Record<Phase, string> = {
    input: '',
    validating: 'Validating Stripe keys...',
    'generating-keys': 'Generating RSA license key pair (pnpm stripe:keys -- --write)...',
    seeding: 'Creating products, prices, and webhook (pnpm stripe:seed)...',
    done: 'Stripe configured!',
  };

  return (
    <WizardStep
      title="Connect Stripe"
      description="Enter your Stripe API keys. Products, prices, and webhooks will be created automatically."
      error={error}
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-neutral-300" htmlFor="stripe-secret">
            Secret Key
          </label>
          <Input
            id="stripe-secret"
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="sk_live_..."
            disabled={phase !== 'input'}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-neutral-300" htmlFor="stripe-pub">
            Publishable Key
          </label>
          <Input
            id="stripe-pub"
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder="pk_live_..."
            disabled={phase !== 'input'}
          />
        </div>

        {phase !== 'input' && (
          <div className={`rounded-lg border p-4 ${phase === 'done' ? 'border-green-800 bg-green-900/20' : 'border-neutral-700 bg-neutral-800'}`}>
            <p className={`text-sm ${phase === 'done' ? 'text-green-400' : 'text-neutral-300'}`}>
              {phaseLabel[phase]}
            </p>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          {phase === 'input' && (
            <Button variant="primary" onClick={connect} disabled={!secretKey.trim() || !publishableKey.trim()}>
              Connect & Configure
            </Button>
          )}
          {phase === 'done' && (
            <Button variant="primary" onClick={onNext}>Next</Button>
          )}
        </div>
      </div>
    </WizardStep>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter studio typecheck
git add apps/studio/src/components/deploy/StepStripe.tsx
git commit -m "feat(studio): implement Step 3 — Connect Stripe"
```

---

### Task 18: Step 4 — Connect Email

**Files:**
- Replace placeholder: `apps/studio/src/components/deploy/StepEmail.tsx`

- [ ] **Step 1: Implement StepEmail**

```tsx
import { useCallback, useState } from 'react';
import { resendSendTest } from '../../lib/deploy';
import type { StudioConfig } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepEmailProps {
  config: StudioConfig;
  onUpdate: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

type Provider = 'resend' | 'smtp';

export default function StepEmail({ config, onUpdate, onNext }: StepEmailProps) {
  const [provider, setProvider] = useState<Provider>('resend');
  const [resendKey, setResendKey] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (provider === 'resend') {
        await resendSendTest(resendKey, testEmail);
      }
      // SMTP test would go through a different command (future)
      setSent(true);
      await onUpdate({
        deploy: {
          ...config.deploy,
          emailProvider: provider,
          supabaseEnabled: config.deploy?.supabaseEnabled ?? false,
        },
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [provider, resendKey, testEmail, config, onUpdate]);

  return (
    <WizardStep
      title="Connect Email"
      description="Required for password reset and email verification. Without email, these features break."
      error={error}
    >
      <div className="space-y-4">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setProvider('resend')}
            className={`rounded-lg border px-4 py-2 text-sm ${
              provider === 'resend' ? 'border-orange-500 text-white' : 'border-neutral-700 text-neutral-400'
            }`}
          >
            Resend (recommended)
          </button>
          <button
            type="button"
            onClick={() => setProvider('smtp')}
            className={`rounded-lg border px-4 py-2 text-sm ${
              provider === 'smtp' ? 'border-orange-500 text-white' : 'border-neutral-700 text-neutral-400'
            }`}
          >
            SMTP
          </button>
        </div>

        {provider === 'resend' && (
          <Input
            type="password"
            value={resendKey}
            onChange={(e) => setResendKey(e.target.value)}
            placeholder="RESEND_API_KEY (from resend.com)"
          />
        )}

        {provider === 'smtp' && (
          <div className="space-y-3">
            <Input placeholder="SMTP Host" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
            <Input placeholder="SMTP Port (587)" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
            <Input placeholder="SMTP User" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
            <Input type="password" placeholder="SMTP Password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} />
          </div>
        )}

        <Input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="Your email (for test delivery)"
        />

        {sent && (
          <div className="rounded-lg border border-green-800 bg-green-900/20 p-4">
            <p className="text-sm text-green-400">Test email sent! Check your inbox.</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={sendTest} loading={loading} disabled={!testEmail.trim()}>
            Send Test Email
          </Button>
          {sent && (
            <Button variant="primary" onClick={onNext}>Next</Button>
          )}
        </div>
      </div>
    </WizardStep>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter studio typecheck
git add apps/studio/src/components/deploy/StepEmail.tsx
git commit -m "feat(studio): implement Step 4 — Connect Email"
```

---

### Task 19: Step 5 — Connect Blob Storage

**Files:**
- Replace placeholder: `apps/studio/src/components/deploy/StepBlob.tsx`

- [ ] **Step 1: Implement StepBlob**

```tsx
import { useState } from 'react';
import type { StudioConfig } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepBlobProps {
  config: StudioConfig;
  onUpdate: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

export default function StepBlob({ config, onUpdate, onNext }: StepBlobProps) {
  const [blobToken, setBlobToken] = useState('');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    // Token is stored and pushed to Vercel in the deploy step.
    // Here we just capture it in config.
    setSaved(true);
  };

  return (
    <WizardStep
      title="Connect Blob Storage"
      description="Vercel Blob is required for CMS media uploads. Without it, uploads fail with 500 errors."
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 p-4">
          <p className="text-sm text-neutral-300">
            In your Vercel dashboard: Project &rarr; Storage &rarr; Create Blob Store.
            Copy the <code className="text-orange-400">BLOB_READ_WRITE_TOKEN</code>.
          </p>
        </div>

        <Input
          type="password"
          value={blobToken}
          onChange={(e) => {
            setBlobToken(e.target.value);
            setSaved(false);
          }}
          placeholder="BLOB_READ_WRITE_TOKEN"
        />

        {saved && (
          <div className="rounded-lg border border-green-800 bg-green-900/20 p-4">
            <p className="text-sm text-green-400">Blob token saved.</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {!saved && (
            <Button variant="secondary" onClick={save} disabled={!blobToken.trim()}>
              Save Token
            </Button>
          )}
          {saved && (
            <Button variant="primary" onClick={onNext}>Next</Button>
          )}
        </div>
      </div>
    </WizardStep>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter studio typecheck
git add apps/studio/src/components/deploy/StepBlob.tsx
git commit -m "feat(studio): implement Step 5 — Connect Blob Storage"
```

---

## Chunk 5: Deploy Wizard Frontend — Steps 6-9 + Adaptive Dashboard

### Task 20: Step 6 — Generate Secrets

**Files:**
- Replace placeholder: `apps/studio/src/components/deploy/StepSecrets.tsx`

- [ ] **Step 1: Implement StepSecrets**

```tsx
import { useCallback, useState } from 'react';
import { generateSecret, generateKek } from '../../lib/deploy';
import type { StudioConfig } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepSecretsProps {
  config: StudioConfig;
  onUpdate: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

interface Secrets {
  revealuiSecret: string;
  revealuiKek: string;
  cronSecret: string;
}

export default function StepSecrets({ onNext }: StepSecretsProps) {
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [revealuiSecret, revealuiKek, cronSecret] = await Promise.all([
        generateSecret(48),
        generateKek(),
        generateSecret(48),
      ]);
      setSecrets({ revealuiSecret, revealuiKek, cronSecret });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <WizardStep
      title="Generate Secrets"
      description="Cryptographic secrets for session encryption, field-level encryption, and cron authentication. These are never shown to you — they go straight to Vercel env vars."
      error={error}
    >
      <div className="space-y-4">
        {!secrets && (
          <Button variant="primary" onClick={generate} loading={loading}>
            Generate All Secrets
          </Button>
        )}

        {secrets && (
          <>
            <div className="space-y-2">
              {[
                { label: 'REVEALUI_SECRET', desc: 'Session encryption (48 chars)' },
                { label: 'REVEALUI_KEK', desc: 'Field-level AES key (64 hex chars / 256 bits)' },
                { label: 'REVEALUI_CRON_SECRET', desc: 'Cron endpoint auth (48 chars)' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3 rounded-lg border border-green-800 bg-green-900/20 px-4 py-2">
                  <span className="text-green-400">{'\u2713'}</span>
                  <div>
                    <p className="text-sm font-medium text-white">{s.label}</p>
                    <p className="text-xs text-neutral-400">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-neutral-500">
              These will be pushed to Vercel env vars in the Deploy step. They are never committed to git or shown in logs.
            </p>

            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={onNext}>Next</Button>
            </div>
          </>
        )}
      </div>
    </WizardStep>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter studio typecheck
git add apps/studio/src/components/deploy/StepSecrets.tsx
git commit -m "feat(studio): implement Step 6 — Generate Secrets"
```

---

### Task 21: Step 7 — Configure Domain & CORS

**Files:**
- Replace placeholder: `apps/studio/src/components/deploy/StepDomain.tsx`

- [ ] **Step 1: Implement StepDomain**

```tsx
import { useMemo, useState } from 'react';
import type { StudioConfig } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepDomainProps {
  config: StudioConfig;
  onUpdate: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

export default function StepDomain({ config, onUpdate, onNext }: StepDomainProps) {
  const [domain, setDomain] = useState(config.deploy?.domain ?? '');
  const [signupOpen, setSignupOpen] = useState(true);
  const [brandName, setBrandName] = useState('');
  const [saved, setSaved] = useState(false);

  const derived = useMemo(() => {
    if (!domain) return null;
    const clean = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return {
      apiUrl: `https://api.${clean}`,
      cmsUrl: `https://cms.${clean}`,
      marketingUrl: `https://${clean}`,
      corsOrigin: `https://cms.${clean},https://${clean}`,
      cookieDomain: `.${clean}`,
    };
  }, [domain]);

  const save = async () => {
    if (!derived) return;
    await onUpdate({
      deploy: {
        ...config.deploy,
        domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        supabaseEnabled: config.deploy?.supabaseEnabled ?? false,
      },
    });
    setSaved(true);
  };

  const dnsRecords = derived
    ? [
        { type: 'CNAME', name: 'api', value: 'cname.vercel-dns.com' },
        { type: 'CNAME', name: 'cms', value: 'cname.vercel-dns.com' },
        { type: 'CNAME', name: '@', value: 'cname.vercel-dns.com' },
      ]
    : [];

  return (
    <WizardStep
      title="Configure Domain & CORS"
      description="Enter your domain. Env vars and DNS records will be derived automatically."
    >
      <div className="space-y-4">
        <Input
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            setSaved(false);
          }}
          placeholder="acme.com"
        />

        {derived && (
          <>
            <div className="space-y-2 rounded-lg border border-neutral-700 bg-neutral-800 p-4">
              <h3 className="text-sm font-medium text-white">Derived URLs</h3>
              <div className="space-y-1 text-sm">
                <p className="text-neutral-300">API: <code className="text-orange-400">{derived.apiUrl}</code></p>
                <p className="text-neutral-300">CMS: <code className="text-orange-400">{derived.cmsUrl}</code></p>
                <p className="text-neutral-300">Marketing: <code className="text-orange-400">{derived.marketingUrl}</code></p>
                <p className="text-neutral-300">CORS: <code className="text-orange-400">{derived.corsOrigin}</code></p>
                <p className="text-neutral-300">Cookie domain: <code className="text-orange-400">{derived.cookieDomain}</code></p>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-700 bg-neutral-800 p-4">
              <h3 className="mb-2 text-sm font-medium text-white">DNS Records (create these at your registrar)</h3>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-neutral-400">
                    <th className="pb-1">Type</th>
                    <th className="pb-1">Name</th>
                    <th className="pb-1">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {dnsRecords.map((r) => (
                    <tr key={r.name} className="text-neutral-300">
                      <td className="py-0.5">{r.type}</td>
                      <td className="py-0.5">{r.name}</td>
                      <td className="py-0.5 font-mono text-xs">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 rounded-lg border border-neutral-700 bg-neutral-800 p-4">
              <h3 className="text-sm font-medium text-white">Options</h3>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="signup-open"
                  checked={signupOpen}
                  onChange={(e) => setSignupOpen(e.target.checked)}
                  className="rounded border-neutral-600"
                />
                <label className="text-sm text-neutral-300" htmlFor="signup-open">
                  Open signups (REVEALUI_SIGNUP_OPEN)
                </label>
              </div>
              <Input
                placeholder="Brand name (default: RevealUI)"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
              />
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {!saved && (
            <Button variant="primary" onClick={save} disabled={!domain.trim()}>
              Save Configuration
            </Button>
          )}
          {saved && (
            <Button variant="primary" onClick={onNext}>Next</Button>
          )}
        </div>
      </div>
    </WizardStep>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter studio typecheck
git add apps/studio/src/components/deploy/StepDomain.tsx
git commit -m "feat(studio): implement Step 7 — Configure Domain & CORS"
```

---

### Task 22: Step 8 — Deploy

**Files:**
- Replace placeholder: `apps/studio/src/components/deploy/StepDeploy.tsx`

- [ ] **Step 1: Implement StepDeploy**

```tsx
import { useCallback, useState } from 'react';
import { vercelDeploy, vercelGetDeployment, vercelSetEnv } from '../../lib/deploy';
import type { StudioConfig } from '../../types';
import Button from '../ui/Button';
import WizardStep from './WizardStep';

interface StepDeployProps {
  config: StudioConfig;
  onUpdate: (updates: Partial<StudioConfig>) => Promise<void>;
  onNext: () => Promise<void>;
}

interface AppDeployState {
  status: 'pending' | 'pushing-env' | 'deploying' | 'ready' | 'error';
  error?: string;
  url?: string;
}

export default function StepDeploy({ config, onNext }: StepDeployProps) {
  const apps = ['api', 'cms', 'marketing'] as const;
  const [deployState, setDeployState] = useState<Record<string, AppDeployState>>(
    Object.fromEntries(apps.map((a) => [a, { status: 'pending' }])),
  );
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allReady = apps.every((a) => deployState[a]?.status === 'ready');

  const updateApp = (app: string, state: Partial<AppDeployState>) => {
    setDeployState((prev) => ({ ...prev, [app]: { ...prev[app], ...state } }));
  };

  const deploy = useCallback(async () => {
    const token = config.deploy?.vercelToken;
    if (!token) {
      setError('No Vercel token found. Go back to Step 1.');
      return;
    }

    setDeploying(true);
    setError(null);

    // Deploy all 3 apps in parallel
    await Promise.allSettled(
      apps.map(async (app) => {
        try {
          const projectId = config.deploy?.apps?.[app];
          if (!projectId) {
            updateApp(app, { status: 'error', error: 'No project ID' });
            return;
          }

          updateApp(app, { status: 'deploying' });
          const deployId = await vercelDeploy(token, projectId);

          // Poll until ready (max 5 min)
          const maxAttempts = 60;
          for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const status = await vercelGetDeployment(token, deployId);
            if (status.state === 'READY') {
              updateApp(app, { status: 'ready', url: status.url ?? undefined });
              return;
            }
            if (status.state === 'ERROR' || status.state === 'CANCELED') {
              updateApp(app, { status: 'error', error: `Deploy ${status.state}` });
              return;
            }
          }
          updateApp(app, { status: 'error', error: 'Deploy timed out' });
        } catch (e) {
          updateApp(app, { status: 'error', error: String(e) });
        }
      }),
    );
    setDeploying(false);
  }, [config]);

  const statusIcon = (s: AppDeployState['status']) => {
    switch (s) {
      case 'ready': return '\u2713';
      case 'error': return '\u2717';
      case 'pending': return '\u2022';
      default: return '\u21BB';
    }
  };

  const statusColor = (s: AppDeployState['status']) => {
    switch (s) {
      case 'ready': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'pending': return 'text-neutral-500';
      default: return 'text-yellow-400';
    }
  };

  return (
    <WizardStep
      title="Deploy"
      description="Push env vars and deploy all 3 apps to Vercel in parallel."
      error={error}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          {apps.map((app) => {
            const state = deployState[app];
            return (
              <div key={app} className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={statusColor(state?.status ?? 'pending')}>{statusIcon(state?.status ?? 'pending')}</span>
                  <span className="text-sm font-medium text-white">{app}</span>
                </div>
                <div className="text-xs text-neutral-400">
                  {state?.status === 'error' && <span className="text-red-400">{state.error}</span>}
                  {state?.status === 'ready' && state.url && (
                    <span className="text-green-400">{state.url}</span>
                  )}
                  {state?.status === 'deploying' && 'Deploying...'}
                  {state?.status === 'pushing-env' && 'Pushing env vars...'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-4">
          <p className="text-xs text-yellow-300">
            Job queue workers poll every 5s — Vercel serverless has no persistent process. Ensure cron jobs are configured in apps/api/vercel.json before deploying.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {!allReady && (
            <Button variant="primary" onClick={deploy} loading={deploying}>
              Deploy All
            </Button>
          )}
          {allReady && (
            <Button variant="primary" onClick={onNext}>Next</Button>
          )}
        </div>
      </div>
    </WizardStep>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter studio typecheck
git add apps/studio/src/components/deploy/StepDeploy.tsx
git commit -m "feat(studio): implement Step 8 — Deploy"
```

---

### Task 23: Step 9 — Bootstrap & Verify

**Files:**
- Replace placeholder: `apps/studio/src/components/deploy/StepVerify.tsx`

- [ ] **Step 1: Implement StepVerify**

```tsx
import { useCallback, useState } from 'react';
import { healthCheck } from '../../lib/deploy';
import type { StudioConfig } from '../../types';
import Button from '../ui/Button';
import Input from '../ui/Input';
import WizardStep from './WizardStep';

interface StepVerifyProps {
  config: StudioConfig;
  onUpdate: (updates: Partial<StudioConfig>) => Promise<void>;
  onComplete: () => void;
}

interface Check {
  label: string;
  status: 'pending' | 'checking' | 'pass' | 'fail';
  error?: string;
}

export default function StepVerify({ config, onComplete }: StepVerifyProps) {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const domain = config.deploy?.domain ?? '';

  const [checks, setChecks] = useState<Check[]>([
    { label: 'API health check (/health/ready)', status: 'pending' },
    { label: 'CMS renders login page', status: 'pending' },
    { label: 'Marketing page renders', status: 'pending' },
    { label: 'Database connection (via health)', status: 'pending' },
  ]);
  const [running, setRunning] = useState(false);

  const allPass = checks.every((c) => c.status === 'pass');

  const updateCheck = (index: number, update: Partial<Check>) => {
    setChecks((prev) => prev.map((c, i) => (i === index ? { ...c, ...update } : c)));
  };

  const runChecks = useCallback(async () => {
    if (!domain) return;
    setRunning(true);

    const urls = [
      `https://api.${domain}/health/ready`,
      `https://cms.${domain}`,
      `https://${domain}`,
      `https://api.${domain}/health/ready`,
    ];

    for (let i = 0; i < urls.length; i++) {
      updateCheck(i, { status: 'checking' });
      try {
        const status = await healthCheck(urls[i]);
        updateCheck(i, {
          status: status >= 200 && status < 400 ? 'pass' : 'fail',
          error: status >= 400 ? `HTTP ${status}` : undefined,
        });
      } catch (e) {
        updateCheck(i, { status: 'fail', error: String(e) });
      }
    }
    setRunning(false);
  }, [domain]);

  const statusIcon = (s: Check['status']) => {
    switch (s) {
      case 'pass': return '\u2713';
      case 'fail': return '\u2717';
      case 'checking': return '\u21BB';
      default: return '\u2022';
    }
  };

  return (
    <WizardStep
      title="Bootstrap & Verify"
      description="Create your admin account and verify everything is working."
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white">Admin Account</h3>
          <Input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="admin@acme.com"
          />
          <Input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Password (min 12 characters)"
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white">Verification Checklist</h3>
          {checks.map((c, i) => (
            <div key={c.label} className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2">
              <div className="flex items-center gap-3">
                <span className={c.status === 'pass' ? 'text-green-400' : c.status === 'fail' ? 'text-red-400' : 'text-neutral-500'}>
                  {statusIcon(c.status)}
                </span>
                <span className="text-sm text-neutral-300">{c.label}</span>
              </div>
              {c.error && <span className="text-xs text-red-400">{c.error}</span>}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={runChecks} loading={running}>
            Run Checks
          </Button>
          {allPass && (
            <Button variant="primary" onClick={onComplete}>
              Complete Setup
            </Button>
          )}
        </div>

        {allPass && (
          <div className="rounded-lg border border-green-800 bg-green-900/20 p-6 text-center">
            <h2 className="text-lg font-bold text-green-400">Your RevealUI instance is live!</h2>
            <div className="mt-3 space-y-1 text-sm text-neutral-300">
              <p>API: <code className="text-orange-400">https://api.{domain}</code></p>
              <p>CMS: <code className="text-orange-400">https://cms.{domain}</code></p>
              <p>Marketing: <code className="text-orange-400">https://{domain}</code></p>
            </div>
          </div>
        )}
      </div>
    </WizardStep>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm --filter studio typecheck
git add apps/studio/src/components/deploy/StepVerify.tsx
git commit -m "feat(studio): implement Step 9 — Bootstrap & Verify"
```

---

### Task 24: Adaptive deploy dashboard

After the deploy wizard completes, the dashboard should show deployment health instead of the dev companion view.

**Files:**
- Create: `apps/studio/src/components/dashboard/DeployDashboard.tsx`
- Modify: `apps/studio/src/App.tsx` (render DeployDashboard when intent=deploy + setupComplete)

- [ ] **Step 1: Create DeployDashboard**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { healthCheck } from '../../lib/deploy';
import { getConfig } from '../../lib/config';
import type { StudioConfig } from '../../types';

interface ServiceHealth {
  name: string;
  url: string;
  status: 'checking' | 'healthy' | 'degraded' | 'down';
}

export default function DeployDashboard() {
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [services, setServices] = useState<ServiceHealth[]>([]);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  const checkHealth = useCallback(async () => {
    const domain = config?.deploy?.domain;
    if (!domain) return;

    const checks: ServiceHealth[] = [
      { name: 'API', url: `https://api.${domain}/health/ready`, status: 'checking' },
      { name: 'CMS', url: `https://cms.${domain}`, status: 'checking' },
      { name: 'Marketing', url: `https://${domain}`, status: 'checking' },
    ];
    setServices(checks);

    const updated = await Promise.all(
      checks.map(async (svc) => {
        try {
          const code = await healthCheck(svc.url);
          return { ...svc, status: (code >= 200 && code < 400 ? 'healthy' : 'degraded') as ServiceHealth['status'] };
        } catch {
          return { ...svc, status: 'down' as const };
        }
      }),
    );
    setServices(updated);
  }, [config]);

  useEffect(() => {
    if (config?.deploy?.domain) {
      checkHealth();
      const interval = setInterval(checkHealth, 60_000);
      return () => clearInterval(interval);
    }
  }, [config, checkHealth]);

  const statusColor = (s: ServiceHealth['status']) => {
    switch (s) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-red-500';
      default: return 'bg-neutral-500 animate-pulse';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Deployment Health</h1>
        <button
          type="button"
          onClick={checkHealth}
          className="text-sm text-neutral-400 hover:text-white"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {services.map((svc) => (
          <div key={svc.name} className="rounded-xl border border-neutral-700 bg-neutral-800 p-4">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusColor(svc.status)}`} />
              <h3 className="font-medium text-white">{svc.name}</h3>
            </div>
            <p className="mt-1 text-xs text-neutral-400">{svc.url}</p>
          </div>
        ))}
      </div>

      {config?.deploy?.domain && (
        <div className="rounded-xl border border-neutral-700 bg-neutral-800 p-4">
          <h3 className="text-sm font-medium text-white">Quick Links</h3>
          <div className="mt-2 space-y-1 text-sm">
            <p><a href={`https://cms.${config.deploy.domain}`} target="_blank" rel="noreferrer" className="text-orange-400 hover:underline">Open CMS Dashboard</a></p>
            <p><a href={`https://api.${config.deploy.domain}/docs`} target="_blank" rel="noreferrer" className="text-orange-400 hover:underline">API Documentation</a></p>
            <p><a href={`https://${config.deploy.domain}`} target="_blank" rel="noreferrer" className="text-orange-400 hover:underline">Marketing Site</a></p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx to render DeployDashboard when intent=deploy + setupComplete**

In the "Setup complete — normal app" section of App.tsx, add a conditional:

```tsx
// After setup is complete
if (config.intent === 'deploy') {
  return (
    <AppShell currentPage={page} onNavigate={setPage}>
      {page === 'dashboard' && <DeployDashboard />}
      {page === 'setup' && <SetupPage />}
    </AppShell>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter studio typecheck
git add apps/studio/src/components/dashboard/DeployDashboard.tsx apps/studio/src/App.tsx
git commit -m "feat(studio): add adaptive DeployDashboard for deploy-intent users"
```

---

### Task 25: Final integration — remove placeholder step files, verify full build

- [ ] **Step 1: Verify all placeholder step files have been replaced with real implementations**

Run: `grep -r "Coming soon" apps/studio/src/components/deploy/`
Expected: No matches (all placeholders replaced)

- [ ] **Step 2: Full typecheck**

Run: `pnpm --filter studio typecheck`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `pnpm --filter studio test -- --run`
Expected: PASS (existing tests should still pass)

- [ ] **Step 4: Verify Rust compiles**

Run: `cd apps/studio/src-tauri && cargo check`
Expected: PASS

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A apps/studio/
git commit -m "feat(studio): complete deploy wizard integration — all 9 steps implemented"
```

---

## Review Corrections (Apply During Implementation)

The following corrections were identified during plan review and MUST be applied by the implementing agent:

### RC-1: Step component props use `WizardData`

All step components receive `data: WizardData` and `onUpdateData: (updates: Partial<WizardData>) => void` instead of `onUpdate: (updates: Partial<StudioConfig>) => void`. Steps that also need to persist non-sensitive metadata to config receive `onUpdateConfig`. The placeholder and step code in this plan was partially updated — the implementing agent must ensure all steps use the `WizardData` pattern shown in the corrected `DeployWizard` container.

### RC-2: StepStripe must run `billing:catalog:sync`

After `stripeRunSeed`, add a phase `'syncing-catalog'` that calls `stripeCatalogSync('.')`. The Stripe seed output contains price IDs and webhook secret — parse stdout and store in `WizardData` via `onUpdateData({ stripeWebhookSecret, stripePriceIds, ... })`.

### RC-3: StepBlob must persist token to WizardData

The `save` function must call `onUpdateData({ blobToken })` — not just `setSaved(true)`.

### RC-4: StepSecrets must persist to WizardData

After generating secrets, call `onUpdateData({ revealuiSecret, revealuiKek, cronSecret })`.

### RC-5: StepDomain must persist all fields to WizardData

Call `onUpdateData({ domain, signupOpen, brandName })` in addition to `onUpdateConfig` for the domain.

### RC-6: StepDeploy must push env vars before deploying

Before calling `vercelDeploy`, push all env vars from `WizardData` using `vercelSetEnv`. The env var matrix:

**API project (~15 vars):**
`POSTGRES_URL`, `REVEALUI_SECRET`, `REVEALUI_KEK`, `REVEALUI_CRON_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `REVEALUI_LICENSE_PRIVATE_KEY`, `REVEALUI_LICENSE_PUBLIC_KEY`, `NEXT_PUBLIC_SERVER_URL` (= `https://api.{domain}`), `REVEALUI_PUBLIC_SERVER_URL` (same), `CORS_ORIGIN`, `RESEND_API_KEY` (or SMTP vars), `REVEALUI_SIGNUP_OPEN`, `REVEALUI_BRAND_NAME`

**CMS project (~12 vars):**
`POSTGRES_URL`, `REVEALUI_SECRET`, `REVEALUI_KEK`, `NEXT_PUBLIC_SERVER_URL`, `REVEALUI_PUBLIC_SERVER_URL`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID`, `REVEALUI_LICENSE_PUBLIC_KEY`

**Marketing project (~5 vars):**
`NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_STRIPE_MAX_PRICE_ID`, `NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID`

Implement as a function `pushEnvVars(token, projectId, vars: Record<string, string>)` that loops over entries calling `vercelSetEnv`.

### RC-7: StepVerify must push admin env vars and run all 9 checks

1. Before running checks, push `REVEALUI_ADMIN_EMAIL` and `REVEALUI_ADMIN_PASSWORD` to the API project via `vercelSetEnv`.
2. Add the 5 missing verification checks:
   - Stripe webhook test: `POST /api/billing/webhook` with test event
   - CORS: `fetch(apiUrl, { headers: { Origin: cmsUrl } })` and check `Access-Control-Allow-Origin`
   - Email delivery: call `resendSendTest` or display "already verified in Step 4"
   - Signup flow: `POST /api/auth/signup` with test credentials (if `signupOpen`)
   - Session cookie: display as "manual verification — requires real browser" with link

### RC-8: Register all new Rust commands in lib.rs

The `generate_handler![]` must include:
```rust
commands::deploy::vercel::vercel_create_project,
commands::deploy::stripe::stripe_catalog_sync,
```
in addition to all commands already listed.

### RC-9: Redundant Step 2 in Task 9

Task 9 Step 2 ("Remove the old `isSetupComplete` import") is redundant since Step 1 replaces the entire `App.tsx`. Skip it during implementation.

### RC-10: Remove ALL useCallback/useMemo from step components

The step component code in Tasks 15-24 and the DeployDashboard (Task 24) all use `useCallback` and/or `useMemo`. Per React Compiler policy (`feedback_react_compiler.md`): **no useCallback, no useMemo, no React.memo**. The implementing agent MUST replace all `useCallback(async () => { ... }, [deps])` with plain `async function name() { ... }` and all `useMemo(() => ..., [deps])` with plain `const name = ...` computed inline. React 19 Compiler handles memoization automatically.

### RC-11: StepDeploy and StepVerify must accept `data: WizardData`

The `StepDeployProps` interface in Task 22 and `StepVerifyProps` in Task 23 are missing `data: WizardData`. The corrected `DeployWizard` container passes `data={data}` to both. The implementing agent must:
- Add `data: WizardData` to both props interfaces
- `StepDeploy`: use `data` to build the env var matrix (RC-6)
- `StepVerify`: use `data.vercelToken` + `config.deploy?.apps?.api` to push admin env vars

### RC-12: StepBlob props — remove `config: StudioConfig`

The corrected DeployWizard passes only `data`, `onUpdateData`, and `onNext` to StepBlob. The StepBlob interface must match.

### RC-13: `neon_test_connection` — fall back to reqwest if psql unavailable

`psql` may not be installed on Windows/macOS. The implementing agent should attempt `psql` first, and if it fails with "command not found", fall back to a simple `reqwest` GET to the Neon HTTP query endpoint. Alternatively, display a clear error: "psql not found — install PostgreSQL client tools or paste a verified connection string."

### RC-14: SetupWizard onClose is synchronous

The existing `SetupWizard` component's `onClose` prop is `() => void` (not async). In App.tsx, fire-and-forget the config update:
```tsx
<SetupWizard onClose={() => { void updateConfig({ setupComplete: true }); }} />
```

---

## Future Work (Not in This Plan)

These items are documented in the spec but deferred to separate plans:

1. **Dev Wizard Improvements** — Active prerequisite installation, platform-adaptive steps, step recovery. Lower priority since the existing wizard works today.
2. **OAuth Vercel Auth** — Step 1 currently uses token paste only. OAuth flow (localhost callback) is a future enhancement.
3. **Neon Project Creation** — Step 2 currently requires pasting a connection string. Auto-provisioning via Neon API is a future enhancement.
4. **Build & Distribution CI** — GitHub Actions workflow for cross-platform builds (`.msi`, `.dmg`, `.AppImage`), auto-update via Tauri updater.
5. **Settings Page** — Allow users to switch intent, reset config, re-run wizard steps.
