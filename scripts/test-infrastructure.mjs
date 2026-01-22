#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

console.log('🧪 RevealUI Infrastructure Test Suite\n');

// Test 1: Node.js Version
console.log('1. Testing Node.js version...');
const nodeVersion = process.version;
console.log(`   Node.js: ${nodeVersion}`);
if (nodeVersion.startsWith('v24.')) {
  console.log('   ✅ Node.js version is correct (24.x)');
} else {
  console.log('   ❌ Node.js version should be 24.x');
}

// Test 2: File Structure
console.log('\n2. Testing file structure...');

const requiredFiles = [
  'package.json',
  'pnpm-workspace.yaml',
  'turbo.json',
  '.nvmrc',
  '.changeset/config.json'
];

let fileChecksPassed = 0;
for (const file of requiredFiles) {
  if (existsSync(file)) {
    console.log(`   ✅ ${file} exists`);
    fileChecksPassed++;
  } else {
    console.log(`   ❌ ${file} missing`);
  }
}

console.log(`   File structure: ${fileChecksPassed}/${requiredFiles.length} files present`);

// Test 3: Workflow Files
console.log('\n3. Testing workflow files...');
const workflowDir = '.github/workflows';
const expectedWorkflows = [
  'ci.yml',
  'security.yml',
  'performance.yml',
  'release.yml',
  'maintenance.yml'
];

let workflowChecksPassed = 0;
if (existsSync(workflowDir)) {
  const workflows = readdirSync(workflowDir).filter(f => f.endsWith('.yml'));
  console.log(`   Found ${workflows.length} workflow files`);

  for (const workflow of expectedWorkflows) {
    if (workflows.includes(workflow)) {
      console.log(`   ✅ ${workflow} present`);
      workflowChecksPassed++;
    } else {
      console.log(`   ❌ ${workflow} missing`);
    }
  }
} else {
  console.log('   ❌ .github/workflows directory missing');
}

// Test 4: Package Scripts
console.log('\n4. Testing package.json scripts...');
const requiredScripts = [
  'changeset',
  'changeset:version',
  'changeset:publish'
];

let scriptChecksPassed = 0;
try {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const scripts = packageJson.scripts || {};

  for (const script of requiredScripts) {
    if (scripts[script]) {
      console.log(`   ✅ ${script} script present`);
      scriptChecksPassed++;
    } else {
      console.log(`   ❌ ${script} script missing`);
    }
  }

  console.log(`   Scripts: ${scriptChecksPassed}/${requiredScripts.length} present`);
} catch (error) {
  console.log('   ❌ Error reading package.json');
}

// Test 5: Validation Scripts
console.log('\n5. Testing validation scripts...');
const validationScripts = [
  'scripts/validate-workspace.mjs',
  'scripts/validate-dependencies.mjs',
  'scripts/validate-types.mjs',
  'scripts/verify-branch-protection.mjs',
  'scripts/setup-branch-protection.mjs'
];

let validationChecksPassed = 0;
for (const script of validationScripts) {
  if (existsSync(script)) {
    console.log(`   ✅ ${script} exists`);
    validationChecksPassed++;
  } else {
    console.log(`   ❌ ${script} missing`);
  }
}

console.log(`   Validation scripts: ${validationChecksPassed}/${validationScripts.length} present`);

// Summary
console.log('\n' + '='.repeat(50));
console.log('🏁 INFRASTRUCTURE TEST SUMMARY');
console.log('='.repeat(50));

const tests = [
  { name: 'Node.js Version', passed: nodeVersion.startsWith('v24.') },
  { name: 'File Structure', passed: fileChecksPassed === requiredFiles.length },
  { name: 'Workflow Files', passed: workflowChecksPassed === expectedWorkflows.length },
  { name: 'Package Scripts', passed: scriptChecksPassed === requiredScripts.length },
  { name: 'Validation Scripts', passed: validationChecksPassed === validationScripts.length }
];

let totalPassed = 0;
for (const test of tests) {
  const status = test.passed ? '✅' : '❌';
  console.log(`${status} ${test.name}`);
  if (test.passed) totalPassed++;
}

console.log('');
console.log(`Overall Score: ${totalPassed}/${tests.length} tests passed`);

if (totalPassed === tests.length) {
  console.log('🎉 All infrastructure tests passed!');
  console.log('\nNext Steps:');
  console.log('1. Set up branch protection rules in GitHub');
  console.log('2. Configure VERCEL_TOKEN secret');
  console.log('3. Create a test PR to validate CI/CD');
} else {
  console.log('⚠️ Some infrastructure tests failed.');
  console.log('Please address the issues above before proceeding.');
}

console.log('='.repeat(50));