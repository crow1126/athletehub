Add-Type -AssemblyName System.Drawing

$icoPath = "c:\Users\samue\Desktop\ghana-football-app\electron\icon.ico"
$exePath = "c:\Users\samue\Desktop\ghana-football-app\dist\win-unpacked\ApexTrack.exe"

Write-Host "Checking ICO file: $icoPath"
$fileBytes = [System.IO.File]::ReadAllBytes($icoPath)
Write-Host "File size:" $fileBytes.Length "bytes"
Write-Host "Header bytes:" ($fileBytes[0..5] -join " ")

# Extract icon from ApexTrack.exe
if (Test-Path $exePath) {
    Write-Host "Extracting icon from ApexTrack.exe..."
    $exeIcon = [System.Drawing.Icon]::ExtractAssociatedIcon($exePath)
    $bmp = $exeIcon.ToBitmap()
    $outPath = "c:\Users\samue\Desktop\ghana-football-app\scratch\exe_extracted_icon.png"
    New-Item -ItemType Directory -Force -Path "c:\Users\samue\Desktop\ghana-football-app\scratch" | Out-Null
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Extracted exe icon saved to: $outPath"
}
