const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get all lexical packages
const packages = fs.readdirSync('.').filter(dir => 
  fs.statSync(dir).isDirectory() && dir.startsWith('lexical-') || dir === 'shared'
);

console.log(`Analyzing ${packages.length} packages...`);

// Collect all @lexical imports
const imports = {};
packages.forEach(pkg => {
  try {
    const files = execSync(`find ${pkg} -name "*.ts" -o -name "*.tsx"`, {encoding: 'utf8'}).trim().split('\n');
    
    files.forEach(file => {
      if (!fs.existsSync(file)) return;
      
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(/from ['"]@lexical\/[^'"]+['"]/g) || [];
      
      matches.forEach(match => {
        const importPath = match.replace(/from ['"]/, '').replace(/['"]/, '');
        if (!imports[importPath]) imports[importPath] = [];
        if (!imports[importPath].includes(pkg)) {
          imports[importPath].push(pkg);
        }
      });
    });
  } catch (e) {
    // Skip packages without src
  }
});

// Generate mapping
console.log('\n=== @lexical Import Analysis ===');
Object.keys(imports).sort().forEach(importPath => {
  const usedBy = imports[importPath];
  console.log(`${importPath} -> used by: ${usedBy.join(', ')}`);
});

// Generate replacement mappings for our setup
console.log('\n=== Replacement Mappings ===');
const mappings = {};
Object.keys(imports).forEach(importPath => {
  // Map @lexical/pkg to our local path
  const pkgName = importPath.replace('@lexical/', '');
  if (packages.includes(`lexical-${pkgName}`) || packages.includes(pkgName)) {
    mappings[importPath] = `../../../lexical/packages/${pkgName === 'shared' ? 'shared' : `lexical-${pkgName}`}/src/index.ts`;
  }
});

// Output mappings
console.log(JSON.stringify(mappings, null, 2));
