# Script to clear Windows Icon Cache and refresh Desktop shortcuts
Write-Host "Stopping Windows Explorer..."
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 1

Write-Host "Clearing IconCache database files..."
$localAppData = $env:LOCALAPPDATA
Remove-Item "$localAppData\IconCache.db" -Force -ErrorAction SilentlyContinue
Remove-Item "$localAppData\Microsoft\Windows\Explorer\iconcache_*.db" -Force -ErrorAction SilentlyContinue
Remove-Item "$localAppData\Microsoft\Windows\Explorer\thumbcache_*.db" -Force -ErrorAction SilentlyContinue

# Delete any existing ApexTrack desktop shortcut so NSIS recreates it fresh
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "ApexTrack.lnk"
if (Test-Path $shortcutPath) {
    Write-Host "Removing old desktop shortcut..."
    Remove-Item $shortcutPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Restarting Windows Explorer..."
Start-Process explorer

Write-Host "Icon Cache cleared successfully!"
