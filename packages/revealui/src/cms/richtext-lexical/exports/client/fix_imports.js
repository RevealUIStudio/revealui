const fs = require('fs');
const path = require('path');

function fixImports(content) {
  // Replace .js with .ts for files that exist
  const lines = content.split('\n');
  const fixedLines = lines.map(line => {
    const match = line.match(/from ['"](.*\.js)['"]/);
    if (match) {
      const importPath = match[1];
      const fullPath = path.resolve(__dirname, importPath);
      
      // Try .ts first
      if (fs.existsSync(fullPath.replace('.js', '.ts'))) {
        return line.replace('.js', '.ts');
      }
      // Try .tsx
      if (fs.existsSync(fullPath.replace('.js', '.tsx'))) {
        return line.replace('.js', '.tsx');
      }
    }
    return line;
  });
  
  return fixedLines.join('\n');
}

const filePath = 'index.ts';
let content = fs.readFileSync(filePath, 'utf8');
const fixedContent = fixImports(content);
fs.writeFileSync(filePath, fixedContent);
console.log('Fixed imports in index.ts');
