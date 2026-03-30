#!/usr/bin/env tsx

/**
 * Secret Scanner
 *
 * Scans git-tracked files for credential patterns.
 * Exits 1 if any secrets are found.
 *
 * Usage:
 *   pnpm secrets:scan
 */

import { execSync } from 'node:child_process';

interface Finding {
  file: string;
  line: number;
  pattern: string;
  content: string;
}

const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  // Password matching RevealUI2026! style (Capital + lower + 4 digits + symbol)
  { name: 'hardcoded-password', regex: /[A-Z][a-z]+[0-9]{4}[!@#$%^&*]/ },
  // Stripe live secret keys
  { name: 'stripe-live-secret', regex: /sk_live_[A-Za-z0-9]{24,}/ },
  // Stripe test secret keys (only flag when value is real, not placeholder)
  { name: 'stripe-test-secret', regex: /sk_test_[A-Za-z0-9]{24,}/ },
  // Resend API keys
  { name: 'resend-api-key', regex: /re_[A-Za-z0-9]{20,}/ },
  // npm tokens
  { name: 'npm-token', regex: /npm_[A-Za-z0-9]{36,}/ },
  // age private keys
  { name: 'age-private-key', regex: /AGE-SECRET-KEY-[A-Z0-9]{59}/ },
  // PEM private key blocks
  { name: 'pem-private-key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  // OpenAI API keys
  { name: 'openai-api-key', regex: /sk-proj-[A-Za-z0-9_-]{20,}/ },
  // Anthropic API keys
  { name: 'anthropic-api-key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  // Supabase service role keys
  { name: 'supabase-service-key', regex: /sbp_[A-Za-z0-9]{20,}/ },
  // Google API keys
  { name: 'google-api-key', regex: /AIza[A-Za-z0-9_-]{35}/ },
  // Neon API keys
  { name: 'neon-api-key', regex: /napi_[A-Za-z0-9]{20,}/ },
  // GitHub personal access tokens
  { name: 'github-pat', regex: /ghp_[A-Za-z0-9]{36,}/ },
  // GitHub fine-grained tokens
  { name: 'github-fine-grained', regex: /github_pat_[A-Za-z0-9_]{20,}/ },
  // AWS access key IDs
  { name: 'aws-access-key', regex: /AKIA[A-Z0-9]{16}/ },
];

// Files and directories to always skip (not secrets even if they match)
const SKIP_PATTERNS = [
  /\.env\.template$/,
  /\.env\.example$/,
  /scripts\/secrets\/scan\.ts$/,
  /SECRETS-MANAGEMENT\.md$/,
  /node_modules\//,
  /\.turbo\//,
  /dist\//,
  /\.next\//,
  /\.git\//,
];

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath));
}

function getTrackedFiles(): string[] {
  const output = execSync('git ls-files', { encoding: 'utf-8', cwd: process.cwd() });
  return output
    .trim()
    .split('\n')
    .filter((f) => f.length > 0)
    .filter((f) => !shouldSkip(f));
}

function scanFile(filePath: string): Finding[] {
  let content: string;
  try {
    const { readFileSync } = require('node:fs');
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { name, regex } of PATTERNS) {
      if (regex.test(line)) {
        findings.push({
          file: filePath,
          line: i + 1,
          pattern: name,
          content: line.trim().slice(0, 120),
        });
      }
    }
  }

  return findings;
}

async function main(): Promise<void> {
  console.log('Scanning tracked files for secrets...\n');

  const files = getTrackedFiles();
  const allFindings: Finding[] = [];

  for (const file of files) {
    const findings = scanFile(file);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) {
    console.log(`✅ No secrets found in ${files.length} tracked files`);
    process.exit(0);
  }

  console.error(`❌ Found ${allFindings.length} potential secret(s):\n`);
  for (const finding of allFindings) {
    console.error(`  ${finding.file}:${finding.line}  [${finding.pattern}]`);
    console.error(`    ${finding.content}`);
    console.error();
  }

  console.error('Fix these before committing:');
  console.error('  - Replace literals with process.env.VAR_NAME references');
  console.error('  - Move credentials to .env.development.local (gitignored)');
  console.error('  - Use RevVault for secrets that need to be shared');
  process.exit(1);
}

main().catch((err) => {
  console.error('scan failed:', err);
  process.exit(1);
});
