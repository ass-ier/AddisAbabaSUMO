# Find all hardcoded colors in CSS files
$cssFiles = Get-ChildItem -Path "src/components" -Filter "*.css" -Recurse

Write-Host "=== Hardcoded Colors Report ===" -ForegroundColor Cyan
Write-Host ""

foreach ($file in $cssFiles) {
    $content = Get-Content $file.FullName -Raw
    
    # Count different types of hardcoded colors
    $hexColors = ([regex]::Matches($content, '#[0-9a-fA-F]{3,6}')).Count
    $rgbColors = ([regex]::Matches($content, 'rgb\(')).Count  
    $rgbaColors = ([regex]::Matches($content, 'rgba\(')).Count
    $namedColors = ([regex]::Matches($content, ':\s*(white|black|gray|red|blue|green)\s*;')).Count
    
    $total = $hexColors + $rgbColors + $rgbaColors + $namedColors
    
    if ($total -gt 0) {
        Write-Host "$($file.Name): $total hardcoded colors" -ForegroundColor Yellow
        Write-Host "  - Hex: $hexColors, RGB: $rgbColors, RGBA: $rgbaColors, Named: $namedColors"
    }
}

Write-Host ""
Write-Host "Run this to fix colors:" -ForegroundColor Green
Write-Host "  Replace hardcoded colors with CSS variables from index.css"
