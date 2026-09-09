# Convert the supplied PNG artwork into multi-resolution Windows icons.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot
foreach ($item in @(
    @('icon.png', 'src/MyTube/Resources/Branding/MyTube.ico'),
    @('music-icon.png', 'src/MyTubeMusic/Resources/app.ico')
)) {
    $source = [System.Drawing.Image]::FromFile((Join-Path $root "docs/$($item[0])"))
    $frames = @()
    foreach ($size in @(16, 24, 32, 48, 64, 128, 256)) {
        $bitmap = [System.Drawing.Bitmap]::new($source, $size, $size)
        $stream = [System.IO.MemoryStream]::new()
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $frames += ,@($size, $stream.ToArray())
        $stream.Dispose()
        $bitmap.Dispose()
    }
    $source.Dispose()
    $output = [System.IO.File]::Create((Join-Path $root $item[1]))
    $writer = [System.IO.BinaryWriter]::new($output)
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
    $offset = 6 + 16 * $frames.Count
    foreach ($frame in $frames) {
        $dimension = if ($frame[0] -eq 256) { 0 } else { $frame[0] }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
        $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$frame[1].Length); $writer.Write([uint32]$offset)
        $offset += $frame[1].Length
    }
    foreach ($frame in $frames) { $writer.Write([byte[]]$frame[1]) }
    $writer.Dispose()
}
