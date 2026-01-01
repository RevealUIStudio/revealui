#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Configuration
const LEXICAL_ROOT = '/home/joshua-v-dev/projects/RevealUI/packages/revealui/src/lexical/packages';

// Create comprehensive import mapping
const importMappings = {
  // External @lexical imports to relative paths
  "from '@lexical/headless'": "from '../../../lexical-headless/src/index.ts'",
  "from '@lexical/utils'": "from '../../../lexical-utils/src/index.ts'",
  "from '@lexical/react'": "from '../../../lexical-react/src/index.ts'",
  "from '@lexical/list'": "from '../../../lexical-list/src/index.ts'",
  "from '@lexical/link'": "from '../../../lexical-link/src/index.ts'",
  "from '@lexical/mark'": "from '../../../lexical-mark/src/index.ts'",
  "from '@lexical/rich-text'": "from '../../../lexical-rich-text/src/index.ts'",
  "from '@lexical/selection'": "from '../../../lexical-selection/src/index.ts'",
  "from '@lexical/html'": "from '../../../lexical-html/src/index.ts'",
  "from '@lexical/markdown'": "from '../../../lexical-markdown/src/index.ts'",
  "from '@lexical/table'": "from '../../../lexical-table/src/index.ts'",
  "from '@lexical/text'": "from '../../../lexical-text/src/index.ts'",
  "from '@lexical/code'": "from '../../../lexical-code/src/index.ts'",
  "from '@lexical/hashtag'": "from '../../../lexical-hashtag/src/index.ts'",
  "from '@lexical/history'": "from '../../../lexical-history/src/index.ts'",
  "from '@lexical/clipboard'": "from '../../../lexical-clipboard/src/index.ts'",
  "from '@lexical/file'": "from '../../../lexical-file/src/index.ts'",
  "from '@lexical/dragon'": "from '../../../lexical-dragon/src/index.ts'",
  "from '@lexical/offset'": "from '../../../lexical-offset/src/index.ts'",
  "from '@lexical/overflow'": "from '../../../lexical-overflow/src/index.ts'",
  "from '@lexical/plain-text'": "from '../../../lexical-plain-text/src/index.ts'",
  "from '@lexical/tailwind'": "from '../../../lexical-tailwind/src/index.ts'",
  "from '@lexical/yjs'": "from '../../../lexical-yjs/src/index.ts'",
  "from '@lexical/devtools'": "from '../../../lexical-devtools/src/index.ts'",
  "from '@lexical/devtools-core'": "from '../../../lexical-devtools-core/src/index.ts'",
  "from '@lexical/eslint-plugin'": "from '../../../lexical-eslint-plugin/src/index.ts'",
  "from '@lexical/extension'": "from '../../../lexical-extension/src/index.ts'",

  // Deep relative imports to lexical utils
  "from '../../../../../lexical/utils/": "from '../../../lexical-utils/src/",
  "from '../../../../lexical/utils/": "from '../../../lexical-utils/src/",
  "from '../../../lexical/utils/": "from '../../../lexical-utils/src/",
  "from '../../lexical/utils/": "from '../../../lexical-utils/src/",
  "from '../lexical/utils/": "from '../../../lexical-utils/src/",

  // Deep relative imports to lexical headless
  "from '../../../../../lexical/": "from '../../../lexical/src/",
  "from '../../../../lexical/": "from '../../../lexical/src/",
  "from '../../../lexical/": "from '../../../lexical/src/",
  "from '../../lexical/": "from '../../../lexical/src/",
  "from '../lexical/": "from '../../../lexical/src/",

  // Deep relative imports to lexical react
  "from '../../../../../lexical-react/": "from '../../../lexical-react/src/",
  "from '../../../../lexical-react/": "from '../../../lexical-react/src/",
  "from '../../../lexical-react/": "from '../../../lexical-react/src/",
  "from '../../lexical-react/": "from '../../../lexical-react/src/",
  "from '../lexical-react/": "from '../../../lexical-react/src/",
};

function findAllLexicalFiles() {
  console.log('🔍 Finding all lexical files...');
  const files = execSync(`find ${LEXICAL_ROOT} -name "*.ts" -o -name "*.tsx"`, { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(f => f.length > 0);

  console.log(`Found ${files.length} TypeScript files`);
  return files;
}

function analyzeImports(files) {
  console.log('📊 Analyzing import patterns...');
  const patterns = new Set();

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      for (const line of lines) {
        // Find import statements
        const importMatch = line.match(/from ['"]([^'"]*)['"]/);
        if (importMatch) {
          const importPath = importMatch[1];
          if (importPath.includes('@lexical/') || importPath.includes('../../../lexical/')) {
            patterns.add(importPath);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read ${file}: ${error.message}`);
    }
  }

  console.log(`Found ${patterns.size} unique import patterns to fix:`);
  Array.from(patterns).sort().forEach(pattern => console.log(`  - ${pattern}`));

  return patterns;
}

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    for (const [oldPattern, newPattern] of Object.entries(importMappings)) {
      if (content.includes(oldPattern)) {
        content = content.replace(new RegExp(oldPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPattern);
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
      return true;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}: ${error.message}`);
  }
  return false;
}

function main() {
  console.log('🚀 Starting lexical import fix process...\n');

  const files = findAllLexicalFiles();
  const patterns = analyzeImports(files);

  console.log('\n🔧 Applying fixes...');
  let fixedCount = 0;

  for (const file of files) {
    if (fixFile(file)) {
      fixedCount++;
    }
  }

  console.log(`\n🎉 Fixed imports in ${fixedCount} files`);
  console.log('📋 Summary:');
  console.log(`   - Total files processed: ${files.length}`);
  console.log(`   - Files with fixes applied: ${fixedCount}`);
  console.log(`   - Unique import patterns found: ${patterns.size}`);
}

if (require.main === module) {
  main();
}
