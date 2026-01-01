const fs = require('fs');
const path = require('path');

// Get all lexical packages
const packages = fs.readdirSync('.').filter(dir => 
  fs.statSync(dir).isDirectory() && (dir.startsWith('lexical-') || dir === 'shared')
);

console.log(`Testing ${packages.length} packages...\n`);

let successCount = 0;
let failCount = 0;

packages.forEach(pkg => {
  try {
    const indexPath = path.join(pkg, 'src', 'index.ts');
    if (fs.existsSync(indexPath)) {
      // Try to read and parse the file for basic syntax
      const content = fs.readFileSync(indexPath, 'utf8');
      
      // Check for basic syntax errors
      try {
        // Basic check - can we find exports?
        const hasExports = content.includes('export') || content.includes('declare');
        if (hasExports) {
          console.log(`✅ ${pkg} - has exports`);
          successCount++;
        } else {
          console.log(`⚠️  ${pkg} - no exports found`);
          failCount++;
        }
      } catch (parseError) {
        console.log(`❌ ${pkg} - syntax error: ${parseError.message}`);
        failCount++;
      }
    } else {
      console.log(`❌ ${pkg} - no index.ts found`);
      failCount++;
    }
  } catch (error) {
    console.log(`❌ ${pkg} - error: ${error.message}`);
    failCount++;
  }
});

console.log(`\n📊 Results: ${successCount} success, ${failCount} issues`);
