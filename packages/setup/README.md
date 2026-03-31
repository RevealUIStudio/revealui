# @revealui/setup

Shared setup utilities for RevealUI projects. Provides environment variable management, database initialization, and configuration validation.

## Features

- **Environment Setup** - Interactive and automated environment variable configuration
- **Secret Generation** - Cryptographically secure secret and password generation
- **Validation** - Type-safe validation for environment variables
- **Logging** - Consistent, colored console output with log levels
- **Reusable** - Used by both @revealui/cli and setup scripts

## Installation

```bash
pnpm add @revealui/setup
```

## Usage

### Environment Setup

```typescript
import { setupEnvironment } from '@revealui/setup/environment'

// Interactive setup with prompts
const result = await setupEnvironment({
  projectRoot: '/path/to/project',
  interactive: true
})

if (result.success) {
  console.log('Environment configured!')
} else {
  console.log('Missing variables:', result.missing)
}
```

### Generate Secrets

```typescript
import { generateSecret, generatePassword } from '@revealui/setup/environment'

const jwtSecret = generateSecret(32)    // 64-char hex string
const password = generatePassword(16)    // 16-char alphanumeric + special
```

### Validate Environment

```typescript
import { validateEnv, REQUIRED_ENV_VARS } from '@revealui/setup/validators'

const validation = validateEnv(REQUIRED_ENV_VARS, process.env)

if (!validation.valid) {
  console.log('Missing:', validation.missing)
  console.log('Invalid:', validation.invalid)
}
```

### Logging

```typescript
import { createLogger } from '@revealui/setup/utils'

const logger = createLogger({
  prefix: 'MyScript',
  level: 'info',
  timestamps: true
})

logger.info('Starting process')
logger.success('Completed!')
logger.error('Failed')
logger.header('Section Title')
logger.divider()
logger.progress(50, 100, 'Processing')
```

## API Reference

### Environment

#### `setupEnvironment(options)`

Sets up environment variables for a project.

**Options:**
- `projectRoot: string` - Project root directory
- `templatePath?: string` - Path to .env.template (default: `{projectRoot}/.env.template`)
- `outputPath?: string` - Output path (default: `{projectRoot}/.env.development.local`)
- `force?: boolean` - Overwrite existing file without prompting
- `generateOnly?: boolean` - Only generate secrets, skip prompts
- `interactive?: boolean` - Enable interactive prompts (default: true)
- `customVariables?: EnvVariable[]` - Custom variable definitions
- `logger?: Logger` - Custom logger instance

**Returns:** `Promise<SetupEnvironmentResult>`
- `success: boolean` - Whether setup completed successfully
- `envPath: string` - Path to generated env file
- `missing: string[]` - Variables still missing
- `invalid: string[]` - Variables with invalid values

#### `generateSecret(length?: number)`

Generates cryptographically secure hex string.

#### `generatePassword(length?: number)`

Generates random password with alphanumeric + special characters.

#### `updateEnvValue(content, key, value)`

Updates or adds an environment variable in file content.

#### `parseEnvContent(content)`

Parses environment file content into key-value object.

### Validators

#### `validateEnv(required, env)`

Validates environment variables against schema.

**Parameters:**
- `required: EnvVariable[]` - Required variable definitions
- `env: Record<string, string>` - Environment to validate

**Returns:** `ValidationResult`
- `valid: boolean`
- `missing: string[]`
- `invalid: string[]`

#### `validators`

Pre-built validators:
- `postgresUrl` - PostgreSQL connection string
- `stripeSecretKey` - Stripe secret key format
- `stripePublishableKey` - Stripe publishable key format
- `url` - Valid URL format
- `email` - Valid email format
- `minLength(n)` - Minimum string length

#### `REQUIRED_ENV_VARS`

Default required environment variables for RevealUI:
- `REVEALUI_SECRET` - JWT secret (min 32 chars)
- `POSTGRES_URL` - Database connection string
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob token
- `STRIPE_SECRET_KEY` - Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key

#### `OPTIONAL_ENV_VARS`

Optional environment variables (Supabase, Sentry, admin config, etc.)

### Utilities

#### `createLogger(options)`

Creates a logger instance with configurable options.

**Options:**
- `level?: 'debug' | 'info' | 'warn' | 'error' | 'silent'`
- `prefix?: string` - Prefix for all log messages
- `colors?: boolean` - Enable colors (auto-detected by default)
- `timestamps?: boolean` - Include timestamps

**Methods:**
- `debug(msg, ...args)` - Debug message
- `info(msg, ...args)` - Info message
- `warn(msg, ...args)` - Warning message
- `error(msg, ...args)` - Error message
- `success(msg, ...args)` - Success message
- `header(msg)` - Formatted header
- `divider()` - Visual divider
- `table(data)` - Console table
- `group(label)` - Start group
- `groupEnd()` - End group
- `progress(current, total, label?)` - Progress bar

## Examples

### Complete Setup Flow

```typescript
import { setupEnvironment, createLogger } from '@revealui/setup'

const logger = createLogger({ prefix: 'Setup' })

logger.header('Project Setup')

const result = await setupEnvironment({
  projectRoot: process.cwd(),
  interactive: true,
  logger
})

if (result.success) {
  logger.success('Environment configured successfully!')
  logger.info(`Config file: ${result.envPath}`)
} else {
  logger.error('Setup failed')
  logger.info('Missing variables:', result.missing.join(', '))
}
```

### Non-Interactive Setup

```typescript
import { setupEnvironment } from '@revealui/setup'

// Generate secrets only, no prompts
const result = await setupEnvironment({
  projectRoot: '/path/to/project',
  interactive: false,
  generateOnly: true
})
```

### Custom Validation

```typescript
import { validateEnv, validators, type EnvVariable } from '@revealui/setup/validators'

const customVars: EnvVariable[] = [
  {
    name: 'API_KEY',
    description: 'Third-party API key',
    required: true,
    validator: validators.minLength(20)
  },
  {
    name: 'WEBHOOK_URL',
    description: 'Webhook endpoint',
    required: true,
    validator: validators.url
  }
]

const validation = validateEnv(customVars, process.env)
```

## Package Exports

```typescript
// Main export
import { setupEnvironment, createLogger } from '@revealui/setup'

// Subpath exports
import { setupEnvironment } from '@revealui/setup/environment'
import { validateEnv } from '@revealui/setup/validators'
import { createLogger } from '@revealui/setup/utils'
```

## Integration

### In @revealui/cli

```typescript
import { setupEnvironment, createLogger } from '@revealui/setup'

const logger = createLogger({ prefix: '@revealui/cli' })

await setupEnvironment({
  projectRoot: projectPath,
  interactive: true,
  logger
})
```

### In Setup Scripts

```typescript
#!/usr/bin/env tsx
import { setupEnvironment } from '@revealui/setup'

await setupEnvironment({
  projectRoot: process.cwd(),
  force: process.argv.includes('--force')
})
```

## Development

```bash
# Build package
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm typecheck

# Run tests
pnpm test

# Coverage
pnpm test:coverage
```

## When to Use This

- You're building setup scripts or CLI tools that need environment variable management
- You need cryptographically secure secret generation for JWT keys or database passwords
- You want consistent, colored logging with progress bars for setup flows
- **Not** for runtime config access — use `@revealui/config` after setup is complete
- **Not** for end-user-facing logging — use `@revealui/utils/logger` in application code

## JOSHUA Alignment

- **Justifiable**: Every utility exists because `@revealui/cli` and setup scripts need it — no speculative abstractions
- **Hermetic**: Validation catches missing or malformed variables before they propagate into runtime
- **Sovereign**: Generates secrets locally with `crypto.randomBytes` — no external service required

## License

MIT
