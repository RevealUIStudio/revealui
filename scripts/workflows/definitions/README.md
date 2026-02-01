# Workflow Templates

Reusable workflow templates for common automation tasks.

## Available Templates

### 1. Deploy Workflow (`deploy.ts`)

Automated deployment workflow with pre-deployment checks and staged rollout.

**Features:**
- Pre-deployment validation
- Build verification
- Test execution
- Manual approval (optional)
- Multiple deployment strategies (rolling, blue-green, canary)
- Smoke tests
- Auto-rollback on failure

**Usage:**
```typescript
import { createDeployWorkflow, deployPresets } from './definitions/deploy.js'

// Custom configuration
const workflow = createDeployWorkflow({
  environment: 'production',
  requireApproval: true,
  strategy: 'blue-green',
  autoRollback: true,
})

// Or use presets
const prodDeploy = deployPresets.production()
const stagingDeploy = deployPresets.staging()
```

**Presets:**
- `development`: Fast deployment without approval
- `staging`: Deployment with smoke tests
- `production`: Full deployment with approval and rollback

### 2. Release Workflow (`release.ts`)

Automated release workflow for version management and publishing.

**Features:**
- Version bumping (major, minor, patch, prerelease)
- Changelog generation
- Test execution
- Git tagging
- npm publishing
- GitHub release creation
- Dry-run mode

**Usage:**
```typescript
import { createReleaseWorkflow, releasePresets } from './definitions/release.js'

// Custom configuration
const workflow = createReleaseWorkflow({
  versionType: 'minor',
  publish: true,
  createGitHubRelease: true,
  generateChangelog: true,
})

// Or use presets
const patchRelease = releasePresets.patch()
const minorRelease = releasePresets.minor()
const dryRun = releasePresets.dryRun('minor')
```

**Presets:**
- `patch`: Quick patch release
- `minor`: Minor release with changelog
- `major`: Major release with full documentation
- `dryRun`: Preview release without changes

### 3. CI Checks Workflow (`ci-checks.ts`)

Comprehensive continuous integration quality checks.

**Features:**
- Linting (ESLint, Biome)
- Type checking (TypeScript)
- Test execution with coverage
- Build verification
- Security audit
- Console statement detection
- Documentation validation
- Configurable failure modes

**Usage:**
```typescript
import { createCIWorkflow, ciPresets } from './definitions/ci-checks.js'

// Custom configuration
const workflow = createCIWorkflow({
  runLint: true,
  runTypeCheck: true,
  runTests: true,
  coverage: true,
  failOnWarnings: false,
})

// Or use presets
const quickCheck = ciPresets.quick()
const fullCheck = ciPresets.comprehensive()
const strictCheck = ciPresets.strict()
```

**Presets:**
- `quick`: Fast lint and typecheck only
- `standard`: Lint, typecheck, tests, build
- `comprehensive`: All checks enabled
- `strict`: All checks with failOnWarnings

## Creating Custom Workflows

### Basic Structure

```typescript
import type { WorkflowStep } from '../../lib/state/index.js'

export interface MyWorkflowConfig {
  // Configuration options
  option1: boolean
  option2?: string
}

export function createMyWorkflow(config: MyWorkflowConfig): {
  id: string
  name: string
  steps: WorkflowStep[]
} {
  const steps: WorkflowStep[] = [
    {
      id: 'step-1',
      name: 'Step Name',
      description: 'What this step does',
      action: async () => {
        // Implementation
        return {
          success: true,
          message: 'Step completed',
        }
      },
      onSuccess: 'step-2',
      onFailure: 'abort',
    },
    // More steps...
  ]

  return {
    id: `my-workflow-${Date.now()}`,
    name: 'My Workflow',
    steps,
  }
}
```

### Conditional Steps

Use spread operator for conditional steps:

```typescript
const steps: WorkflowStep[] = [
  // Always included
  {
    id: 'required-step',
    // ...
  },

  // Conditionally included
  ...(config.enableOptional
    ? [
        {
          id: 'optional-step',
          // ...
        } as WorkflowStep,
      ]
    : []),
]
```

### Step Flow Control

Control workflow execution flow:

```typescript
{
  id: 'step-id',
  name: 'Step Name',
  description: 'Description',
  requiresApproval: true, // Pause for manual approval
  action: async () => {
    // Implementation
    return {
      success: true,
      message: 'Done',
    }
  },
  onSuccess: 'next-step',    // Go here if successful
  onFailure: 'error-step',   // Go here if failed
}
```

## Best Practices

1. **Idempotency**: Steps should be safe to re-run
2. **Error Handling**: Always provide cleanup/rollback steps
3. **Logging**: Log progress and results
4. **Validation**: Check prerequisites before proceeding
5. **Approval**: Require approval for destructive operations
6. **Testing**: Test workflows in dry-run mode first
7. **Documentation**: Document workflow purpose and steps

## Integration

Workflows integrate with:
- **Telemetry**: Automatic performance tracking
- **Logging**: Progress and error reporting
- **State Management**: Workflow state persistence
- **Approval System**: Manual intervention support

## Examples

See `scripts/workflows/` for workflow execution examples:
- `start.ts`: Start a workflow
- `engine.ts`: Workflow automation engine
- `cancel.ts`: Cancel running workflows

## Testing

Test workflows with dry-run mode:

```typescript
const workflow = createReleaseWorkflow({
  versionType: 'minor',
  dryRun: true, // No actual changes
})
```

## Contributing

When adding new workflow templates:

1. Create template file in `definitions/`
2. Export from `index.ts`
3. Add presets for common use cases
4. Document configuration options
5. Add usage examples
6. Include in this README

---

For more information, see the main workflows README at `scripts/workflows/README.md`.
