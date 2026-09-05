Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\samue\Desktop\ghana-football-app\public\icons\icon-512.png"
if (-not (Test-Path $sourcePath)) {
    $sourcePath = "C:\Users\samue\Desktop\ghana-football-app\public\icons\app-icon-source.jpg"
}

Write-Output "Using source image: $sourcePath"
$sourceImg = [System.Drawing.Image]::FromFile($sourcePath)
$resDir = "C:\Users\samue\Desktop\ghana-football-app\android\app\src\main\res"

# Standard launcher sizes: mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
# Adaptive foreground sizes: mdpi=108, hdpi=162, xhdpi=216, xxhdpi=324, xxxhdpi=432
$sizes = @(
    @{ Folder = "mipmap-mdpi"; Size = 48; FgSize = 108 },
    @{ Folder = "mipmap-hdpi"; Size = 72; FgSize = 162 },
    @{ Folder = "mipmap-xhdpi"; Size = 96; FgSize = 216 },
    @{ Folder = "mipmap-xxhdpi"; Size = 144; FgSize = 324 },
    @{ Folder = "mipmap-xxxhdpi"; Size = 192; FgSize = 432 }
)

foreach ($item in $sizes) {
    $targetDir = Join-Path $resDir $item.Folder
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    # 1. Legacy Launcher Icon (square / full)
    $dim = $item.Size
    $bmpLauncher = New-Object System.Drawing.Bitmap $dim, $dim
    $g1 = [System.Drawing.Graphics]::FromImage($bmpLauncher)
    $g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g1.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g1.DrawImage($sourceImg, 0, 0, $dim, $dim)
    $g1.Dispose()

    $launcherPath = Join-Path $targetDir "ic_launcher.png"
    $bmpLauncher.Save($launcherPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $roundPath = Join-Path $targetDir "ic_launcher_round.png"
    $bmpLauncher.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpLauncher.Dispose()

    # 2. Adaptive Foreground Icon (108dp canvas with 72dp centered logo safe zone)
    $fgDim = $item.FgSize
    $bmpFg = New-Object System.Drawing.Bitmap $fgDim, $fgDim
    $g2 = [System.Drawing.Graphics]::FromImage($bmpFg)
    $g2.Clear([System.Drawing.Color]::Transparent)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Draw logo at 70% scale centered so Android adaptive mask does not crop it
    $innerDim = [int]($fgDim * 0.70)
    $offset = [int](($fgDim - $innerDim) / 2)
    $g2.DrawImage($sourceImg, $offset, $offset, $innerDim, $innerDim)
    $g2.Dispose()

    $fgPath = Join-Path $targetDir "ic_launcher_foreground.png"
    $bmpFg.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpFg.Dispose()

    Write-Output "Generated launcher & adaptive foreground for $($item.Folder)"
}

$sourceImg.Dispose()
Write-Output "Complete! All mipmap icons created."
