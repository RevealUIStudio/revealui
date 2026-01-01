const fs = require('fs');
const path = require('path');

/**
 * Comprehensive import path mapping for richtext-lexical
 * Maps old relative paths to new RevealUI module paths
 */
const importMappings = {
  // Core payload imports
  "../../core/payload.js": "@revealui/cms/core/payload",
  "../../core/payload": "@revealui/cms/core/payload",

  // Features imports
  "../features/typesServer.js": "./features/typesServer",
  "../features/typesServer": "./features/typesServer",

  // Lexical config imports
  "../lexical/config/types.js": "./lexical/config/types",
  "../lexical/config/types": "./lexical/config/types",

  // Utility imports (most common pattern)
  "../utilities/": "./utilities/",
  "../../utilities/": "../utilities/",

  // Field imports
  "../../field/": "../field/",

  // Types imports
  "../../types.js": "../types",
  "../../types": "../types",

  // Lexical imports (external @lexical/* -> local lexical packages)
  "'@lexical/headless'": "'../../../lexical/packages/lexical-headless/src/index'",
  "'@lexical/utils'": "'../../../lexical/packages/lexical-utils/src/index'",
  "'@lexical/react'": "'../../../lexical/packages/lexical-react/src/index'",
  "'@lexical/link'": "'../../../lexical/packages/lexical-link/src/index'",
  "'@lexical/list'": "'../../../lexical/packages/lexical-list/src/index'",
  "'@lexical/mark'": "'../../../lexical/packages/lexical-mark/src/index'",
  "'@lexical/rich-text'": "'../../../lexical/packages/lexical-rich-text/src/index'",
  "'@lexical/selection'": "'../../../lexical/packages/lexical-selection/src/index'",
  "'@lexical/html'": "'../../../lexical/packages/lexical-html/src/index'",
  "'@lexical/markdown'": "'../../../lexical/packages/lexical-markdown/src/index'",
  "'@lexical/text'": "'../../../lexical/packages/lexical-text/src/index'",
  "'@lexical/table'": "'../../../lexical/packages/lexical-table/src/index'",
  "'@lexical/plain-text'": "'../../../lexical/packages/lexical-plain-text/src/index'",
  "'@lexical/history'": "'../../../lexical/packages/lexical-history/src/index'",
  "'@lexical/code'": "'../../../lexical/packages/lexical-code/src/index'",
  "'@lexical/hashtag'": "'../../../lexical/packages/lexical-hashtag/src/index'",
  "'@lexical/offset'": "'../../../lexical/packages/lexical-offset/src/index'",
  "'@lexical/overflow'": "'../../../lexical/packages/lexical-overflow/src/index'",
  "'@lexical/file'": "'../../../lexical/packages/lexical-file/src/index'",
  "'@lexical/clipboard'": "'../../../lexical/packages/lexical-clipboard/src/index'",
  "'@lexical/dragon'": "'../../../lexical/packages/lexical-dragon/src/index'",
  "'@lexical/devtools'": "'../../../lexical/packages/lexical-devtools/src/index'",
  "'@lexical/tailwind'": "'../../../lexical/packages/lexical-tailwind/src/index'",
  "'@lexical/yjs'": "'../../../lexical/packages/lexical-yjs/src/index'",

  // Double quotes versions
  '"@lexical/headless"': '"../../../lexical/packages/lexical-headless/src/index"',
  '"@lexical/utils"': '"../../../lexical/packages/lexical-utils/src/index"',
  '"@lexical/react"': '"../../../lexical/packages/lexical-react/src/index"',
  '"@lexical/link"': '"../../../lexical/packages/lexical-link/src/index"',
  '"@lexical/list"': '"../../../lexical/packages/lexical-list/src/index"',
  '"@lexical/mark"': '"../../../lexical/packages/lexical-mark/src/index"',
  '"@lexical/rich-text"': '"../../../lexical/packages/lexical-rich-text/src/index"',
  '"@lexical/selection"': '"../../../lexical/packages/lexical-selection/src/index"',
  '"@lexical/html"': '"../../../lexical/packages/lexical-html/src/index"',
  '"@lexical/markdown"': '"../../../lexical/packages/lexical-markdown/src/index"',
  '"@lexical/text"': '"../../../lexical/packages/lexical-text/src/index"',
  '"@lexical/table"': '"../../../lexical/packages/lexical-table/src/index"',
  '"@lexical/plain-text"': '"../../../lexical/packages/lexical-plain-text/src/index"',
  '"@lexical/history"': '"../../../lexical/packages/lexical-history/src/index"',
  '"@lexical/code"': '"../../../lexical/packages/lexical-code/src/index"',
  '"@lexical/hashtag"': '"../../../lexical/packages/lexical-hashtag/src/index"',
  '"@lexical/offset"': '"../../../lexical/packages/lexical-offset/src/index"',
  '"@lexical/overflow"': '"../../../lexical/packages/lexical-overflow/src/index"',
  '"@lexical/file"': '"../../../lexical/packages/lexical-file/src/index"',
  '"@lexical/clipboard"': '"../../../lexical/packages/lexical-clipboard/src/index"',
  '"@lexical/dragon"': '"../../../lexical/packages/lexical-dragon/src/index"',
  '"@lexical/devtools"': '"../../../lexical/packages/lexical-devtools/src/index"',
  '"@lexical/tailwind"': '"../../../lexical/packages/lexical-tailwind/src/index"',
  '"@lexical/yjs"': '"../../../lexical/packages/lexical-yjs/src/index"',
};

/**
 * Fix imports in a single file
 */
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [oldPath, newPath] of Object.entries(importMappings)) {
    if (content.includes(oldPath)) {
      content = content.replace(new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPath);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${filePath}`);
    return true;
  }

  return false;
}

/**
 * Find and fix all TypeScript files with relative imports
 */
function fixAllImports() {
  const richtextDir = path.dirname(__filename);
  const files = [];

  // Find all TS/TSX files
  function findFiles(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        findFiles(fullPath);
      } else if (stat.isFile() && (item.endsWith('.ts') || item.endsWith('.tsx'))) {
        files.push(fullPath);
      }
    }
  }

  findFiles(richtextDir);

  console.log(`Found ${files.length} TypeScript files to check...`);

  let fixedCount = 0;
  for (const file of files) {
    if (fixFile(file)) {
      fixedCount++;
    }
  }

  console.log(`\n🎉 Fixed imports in ${fixedCount} files out of ${files.length} total files.`);
}

// Run the fixer
if (require.main === module) {
  console.log('🔧 Starting import path fixes for richtext-lexical...\n');
  fixAllImports();
}

module.exports = { fixAllImports, fixFile };
