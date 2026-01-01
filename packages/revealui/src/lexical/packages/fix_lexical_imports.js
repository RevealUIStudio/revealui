const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Comprehensive mapping of @lexical imports to local paths
const mappings = {
  // Main package imports
  '@lexical/clipboard': '../../../lexical/packages/lexical-clipboard/src/index.ts',
  '@lexical/code': '../../../lexical/packages/lexical-code/src/index.ts',
  '@lexical/code-shiki': '../../../lexical/packages/lexical-code-shiki/src/index.ts',
  '@lexical/devtools-core': '../../../lexical/packages/lexical-devtools-core/src/index.ts',
  '@lexical/dragon': '../../../lexical/packages/lexical-dragon/src/index.ts',
  '@lexical/extension': '../../../lexical/packages/lexical-extension/src/index.ts',
  '@lexical/file': '../../../lexical/packages/lexical-file/src/index.ts',
  '@lexical/hashtag': '../../../lexical/packages/lexical-hashtag/src/index.ts',
  '@lexical/headless': '../../../lexical/packages/lexical-headless/src/index.ts',
  '@lexical/history': '../../../lexical/packages/lexical-history/src/index.ts',
  '@lexical/html': '../../../lexical/packages/lexical-html/src/index.ts',
  '@lexical/link': '../../../lexical/packages/lexical-link/src/index.ts',
  '@lexical/list': '../../../lexical/packages/lexical-list/src/index.ts',
  '@lexical/mark': '../../../lexical/packages/lexical-mark/src/index.ts',
  '@lexical/markdown': '../../../lexical/packages/lexical-markdown/src/index.ts',
  '@lexical/offset': '../../../lexical/packages/lexical-offset/src/index.ts',
  '@lexical/overflow': '../../../lexical/packages/lexical-overflow/src/index.ts',
  '@lexical/plain-text': '../../../lexical/packages/lexical-plain-text/src/index.ts',
  '@lexical/rich-text': '../../../lexical/packages/lexical-rich-text/src/index.ts',
  '@lexical/selection': '../../../lexical/packages/lexical-selection/src/index.ts',
  '@lexical/table': '../../../lexical/packages/lexical-table/src/index.ts',
  '@lexical/tailwind': '../../../lexical/packages/lexical-tailwind/src/index.ts',
  '@lexical/text': '../../../lexical/packages/lexical-text/src/index.ts',
  '@lexical/utils': '../../../lexical/packages/lexical-utils/src/index.ts',
  '@lexical/yjs': '../../../lexical/packages/lexical-yjs/src/index.ts',
  
  // Sub-path imports - these need to be mapped to specific files
  '@lexical/headless/dom': '../../../lexical/packages/lexical-headless/src/dom.ts',
  '@lexical/selection/src/__tests__/utils': '../../../lexical/packages/lexical-selection/src/__tests__/utils.ts',
  
  // React sub-path imports - these are more complex, need to map to specific files
  // We'll handle these separately as they have many variations
};

function fixFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Fix main package imports
  for (const [oldPath, newPath] of Object.entries(mappings)) {
    if (content.includes(oldPath)) {
      content = content.replace(new RegExp(`from ['"]${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'), `from '${newPath}'`);
      changed = true;
    }
  }
  
  // Handle @lexical/react sub-path imports
  const reactImports = content.match(/from ['"]@lexical\/react\/[^'"]+['"]/g) || [];
  reactImports.forEach(match => {
    const importPath = match.replace(/from ['"]/, '').replace(/['"]/, '');
    const component = importPath.replace('@lexical/react/', '');
    
    // Try to find the actual file path
    let replacementPath = `../../../lexical/packages/lexical-react/src/${component}.ts`;
    if (!fs.existsSync(path.resolve(path.dirname(filePath), replacementPath))) {
      replacementPath = `../../../lexical/packages/lexical-react/src/${component}.tsx`;
    }
    if (!fs.existsSync(path.resolve(path.dirname(filePath), replacementPath))) {
      // Fallback to index
      replacementPath = '../../../lexical/packages/lexical-react/src/index.ts';
    }
    
    content = content.replace(match, `from '${replacementPath}'`);
    changed = true;
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed: ${filePath}`);
  }
}

// Get all files in lexical packages
const files = execSync('find . -name "*.ts" -o -name "*.tsx"', {encoding: 'utf8'}).trim().split('\n');

console.log(`Processing ${files.length} files...`);
files.forEach(fixFile);

console.log('Import fixing complete!');
