# Check for console statements in production code (PowerShell)

Write-Host "Checking for console statements in production code..." -ForegroundColor Cyan
Write-Host ""

$consoleCount = 0
$filesWithConsole = @()

# Search for console statements
$files = Get-ChildItem -Path "apps/cms/src", "apps/web/src", "packages/reveal/src" -Include "*.ts", "*.tsx", "*.js", "*.jsx" -Recurse -Exclude "node_modules", "__tests__", "dist", ".next" -ErrorAction SilentlyContinue

foreach ($file in $files) {
    $content = Get-Content $file.FullName -ErrorAction SilentlyContinue
    $matches = $content | Select-String -Pattern "console\." -AllMatches
    
    if ($matches) {
        $count = ($matches.Matches | Measure-Object).Count
        $consoleCount += $count
        $filesWithConsole += $file.FullName
    }
}

if ($consoleCount -eq 0) {
    Write-Host "✅ No console statements found in production code" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  Found $consoleCount console statement(s) in production code:" -ForegroundColor Yellow
    Write-Host ""
    foreach ($file in $filesWithConsole) {
        Write-Host "  - $file" -ForegroundColor Gray
        Get-Content $file | Select-String -Pattern "console\." | Select-Object -First 3 | ForEach-Object {
            Write-Host "    $_" -ForegroundColor Gray
        }
    }
    Write-Host ""
    Write-Host "Recommendation: Remove or replace with proper logging service" -ForegroundColor Yellow
    exit 1
}

