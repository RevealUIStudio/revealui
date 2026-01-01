const fs = require('fs');
const path = require('path');

// Mapping of @revealui imports to relative imports
const mappings = {
  // Core utilities
  '@revealui/cms/richtext-lexical/utilities/createServerFeature': '../../../utilities/createServerFeature',
  '@revealui/cms/richtext-lexical/utilities/features': '../../../utilities/features',
  '@revealui/cms/richtext-lexical/utilities/getImportMap': '../../../utilities/getImportMap',
  
  // Types
  '@revealui/cms/richtext-lexical/types': '../../../types',
  
  // Features
  '@revealui/cms/richtext-lexical/features/types': '../../../features/types',
  '@revealui/cms/richtext-lexical/features/typesServer': '../../../features/typesServer',
  
  // Lexical config
  '@revealui/cms/richtext-lexical/lexical/config/types': '../../../lexical/config/types',
  '@revealui/cms/richtext-lexical/lexical/config/client': '../../../lexical/config/client',
  '@revealui/cms/richtext-lexical/lexical/config/server': '../../../lexical/config/server',
  
  // i18n
  '@revealui/cms/richtext-lexical/i18n': '../../../i18n',
};

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  for (const [oldPath, newPath] of Object.entries(mappings)) {
    if (content.includes(oldPath)) {
      content = content.replace(new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPath);
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

// Find and fix all files
const { execSync } = require('child_process');
const files = execSync('find . -name "*.ts" -o -name "*.tsx"', {encoding: 'utf8'}).trim().split('\n');

files.forEach(fixFile);
