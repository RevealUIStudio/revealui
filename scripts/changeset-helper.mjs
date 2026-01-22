#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

console.log('🔍 RevealUI Changeset Helper\n');

// Check if there are any pending changesets
const changesetDir = '.changeset';
const changesetFiles = readdirSync(changesetDir)
  .filter(file => file.endsWith('.md') && file !== 'README.md');

if (changesetFiles.length === 0) {
  console.log('📝 No pending changesets found.');
  console.log('Run `pnpm changeset` to create a new changeset.\n');
} else {
  console.log(`📋 Found ${changesetFiles.length} pending changeset(s):`);
  changesetFiles.forEach(file => {
    try {
      const content = readFileSync(join(changesetDir, file), 'utf8');
      const lines = content.split('\n');
      const packages = lines[0].replace('---', '').trim();
      const summary = lines.slice(2, 4).join(' ').trim();
      console.log(`  • ${file}: ${packages} - ${summary}`);
    } catch (e) {
      console.log(`  • ${file}: (could not parse)`);
    }
  });
  console.log('\n🚀 Ready to release! Run `pnpm release` to publish.\n');
}

// Check package versions
console.log('📦 Current package versions:');
const packages = [
  '@revealui/core',
  '@revealui/config',
  '@revealui/contracts',
  '@revealui/db',
  '@revealui/ai'
];

packages.forEach(pkg => {
  try {
    const version = execSync(`pnpm show ${pkg} version 2>/dev/null || echo "not published"`, { encoding: 'utf8' }).trim();
    console.log(`  • ${pkg}: ${version}`);
  } catch (e) {
    console.log(`  • ${pkg}: not found`);
  }
});

console.log('\n💡 Useful commands:');
console.log('  pnpm changeset        # Create a new changeset');
console.log('  pnpm changeset:version # Update versions based on changesets');
console.log('  pnpm release          # Build, test, and publish');
console.log('  pnpm changeset:publish # Publish packages only');