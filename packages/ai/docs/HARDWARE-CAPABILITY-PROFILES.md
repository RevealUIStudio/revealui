# Hardware capability profiles (GAP-297)

Three named, extendable host tiers for **local-inference vocabulary**. They do not replace operator runtime apply (`local-ai-profile.ts`: idle / daily / snaps / heavy).

| Tier | Intent |
|------|--------|
| `constrained` | Low-RAM WSL / no dedicated GPU (owner machine reference) |
| `mainstream` | Typical laptop/desktop |
| `workstation` | High-RAM / high-VRAM local host |

## Usage

```ts
import {
  resolveHardwareCapabilityProfile,
  listHardwareCapabilityPresets,
} from '@revealui/ai/llm/hardware-capability-profile';

// Default path: no profile configured
resolveHardwareCapabilityProfile(null); // → null (no behavior change)

// Stock preset
const constrained = resolveHardwareCapabilityProfile('constrained');

// User override (copy + fields)
const custom = resolveHardwareCapabilityProfile({
  tier: 'constrained',
  id: 'my-wsl',
  ramGbTypical: 4.7,
  note: 'personal WSL budget',
});
```

## GAP-296

Boundary map entries may cite `tier: constrained | mainstream | workstation` instead of repeating raw RAM/VRAM specs. Verdict evidence still lives in the GAP-296 living doc.

## Extension

Copy a preset object, set `id`, override fields, pass to `resolveHardwareCapabilityProfile`. Overrides set `isOverride: true` and `extends: <tier>`.
