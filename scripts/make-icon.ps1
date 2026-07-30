Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\samue\Desktop\ghana-football-app\public\logo.png"
$destPath   = "C:\Users\samue\Desktop\ghana-football-app\electron\icon.ico"

$src    = [System.Drawing.Image]::FromFile($sourcePath)
$sizes  = @(256, 128, 64, 48, 32, 16)
$ms     = New-Object System.IO.MemoryStream
$bw     = New-Object System.IO.BinaryWriter($ms)
$images = @()

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($src, 0, 0, $size, $size)
    $g.Dispose()
    $imgMs = New-Object System.IO.MemoryStream
    $bmp.Save($imgMs, [System.Drawing.Imaging.ImageFormat]::Png)
    $images += $imgMs
    $bmp.Dispose()
}
$src.Dispose()

# ICO header
$bw.Write([int16]0)
$bw.Write([int16]1)
$bw.Write([int16]$sizes.Count)

$offset = 6 + ($sizes.Count * 16)
for ($i = 0; $i -lt $sizes.Length; $i++) {
    $sz   = $sizes[$i]
    $data = $images[$i].ToArray()
    if ($sz -eq 256) { $b = [byte]0 } else { $b = [byte]$sz }
    $bw.Write($b)
    $bw.Write($b)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([int16]1)
    $bw.Write([int16]32)
    $bw.Write([int32]$data.Length)
    $bw.Write([int32]$offset)
    $offset += $data.Length
}

foreach ($imgMs in $images) {
    $bw.Write($imgMs.ToArray())
    $imgMs.Dispose()
}

$bw.Flush()
[System.IO.File]::WriteAllBytes($destPath, $ms.ToArray())
$bw.Dispose()
$ms.Dispose()

$size = (Get-Item $destPath).Length
Write-Host "ICO created at: $destPath ($size bytes)"

Copy-Item $destPath "C:\Users\samue\Desktop\ghana-football-app\public\icon.ico" -Force
Write-Host "Copied to public/icon.ico"
