Add-Type -AssemblyName System.Drawing

# YouTube-logo shape: red landscape rounded rectangle (W:H ~ 1.45:1) with a
# white play triangle, centered on a square transparent canvas.
function New-YouTubeBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $rectW = $size * 0.86
    $rectH = $rectW / 1.45
    $x = ($size - $rectW) / 2.0
    $y = ($size - $rectH) / 2.0
    $radius = $rectH * 0.30

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($x, $y, 2 * $radius, 2 * $radius, 180, 90)
    $path.AddArc($x + $rectW - 2 * $radius, $y, 2 * $radius, 2 * $radius, 270, 90)
    $path.AddArc($x + $rectW - 2 * $radius, $y + $rectH - 2 * $radius, 2 * $radius, 2 * $radius, 0, 90)
    $path.AddArc($x, $y + $rectH - 2 * $radius, 2 * $radius, 2 * $radius, 90, 90)
    $path.CloseFigure()

    $red = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 0, 0))
    $g.FillPath($red, $path)

    $triW = $rectW * 0.40
    $triH = $rectH * 0.46
    $offset = $rectW * 0.04
    $cx = $x + $rectW / 2.0
    $cy = $y + $rectH / 2.0
    $points = @(
        (New-Object System.Drawing.PointF(($cx - $triW / 2 + $offset), ($cy - $triH / 2))),
        (New-Object System.Drawing.PointF(($cx - $triW / 2 + $offset), ($cy + $triH / 2))),
        (New-Object System.Drawing.PointF(($cx + $triW / 2 + $offset), $cy))
    )
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillPolygon($white, $points)
    $g.Dispose()
    return $bmp
}

# YouTube-Music shape: dark rounded tile with a GLOWING music note.
function New-MusicBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $inset = [Math]::Max(1, [int]($size * 0.06))
    $box = $size - (2 * $inset)
    $radius = [Math]::Max(2, [int]($box * 0.22))
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($inset, $inset, 2 * $radius, 2 * $radius, 180, 90)
    $path.AddArc($inset + $box - 2 * $radius, $inset, 2 * $radius, 2 * $radius, 270, 90)
    $path.AddArc($inset + $box - 2 * $radius, $inset + $box - 2 * $radius, 2 * $radius, 2 * $radius, 0, 90)
    $path.AddArc($inset, $inset + $box - 2 * $radius, 2 * $radius, 2 * $radius, 90, 90)
    $path.CloseFigure()
    $tile = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 23, 22, 30))
    $g.FillPath($tile, $path)

    $glowRect = New-Object System.Drawing.RectangleF(
        [float]($size * 0.10), [float]($size * 0.10), [float]($size * 0.80), [float]($size * 0.80))
    $glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glowPath.AddEllipse($glowRect)
    $glow = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
    $glow.CenterColor = [System.Drawing.Color]::FromArgb(150, 255, 90, 60)
    $glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 255, 90, 60))
    $g.FillPath($glow, $glowPath)

    $noteFont = New-Object System.Drawing.Font('Segoe UI Symbol', [float]($size * 0.40), [System.Drawing.FontStyle]::Regular)
    $noteFormat = New-Object System.Drawing.StringFormat
    $noteFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $noteFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
    $noteRect = New-Object System.Drawing.RectangleF(0, [float](-$size * 0.02), [float]$size, [float]$size)
    $white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.DrawString([string][char]0x266A, $noteFont, $white, $noteRect, $noteFormat)

    $g.Dispose()
    return $bmp
}

# ICO BMP payloads (32bpp BGRA, bottom-up, zero AND mask) for small sizes.
function ConvertTo-IcoBmpPayload([System.Drawing.Bitmap]$bmp) {
    $w = $bmp.Width
    $h = $bmp.Height
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    $bw.Write([UInt32]40)
    $bw.Write([Int32]$w)
    $bw.Write([Int32]($h * 2))
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]32)
    $bw.Write([UInt32]0)
    $bw.Write([UInt32]($w * $h * 4))
    $bw.Write([Int32]0)
    $bw.Write([Int32]0)
    $bw.Write([UInt32]0)
    $bw.Write([UInt32]0)
    for ($y = $h - 1; $y -ge 0; $y--) {
        for ($x = 0; $x -lt $w; $x++) {
            $c = $bmp.GetPixel($x, $y)
            $bw.Write([Byte]$c.B)
            $bw.Write([Byte]$c.G)
            $bw.Write([Byte]$c.R)
            $bw.Write([Byte]$c.A)
        }
    }
    $rowBytes = [int][Math]::Ceiling($w / 8.0)
    $pad = (4 - ($rowBytes % 4)) % 4
    for ($y = 0; $y -lt $h; $y++) {
        for ($i = 0; $i -lt ($rowBytes + $pad); $i++) { $bw.Write([Byte]0) }
    }
    $bw.Flush()
    return $ms.ToArray()
}

function Write-Ico($items, [string]$target) {
    $out = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($out)
    $bw.Write([UInt16]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]$items.Count)
    $offset = 6 + (16 * $items.Count)
    foreach ($entry in $items) {
        $s = [int]$entry[0]
        $data = [byte[]]$entry[1]
        $dim = if ($s -ge 256) { 0 } else { $s }
        $bw.Write([Byte]$dim)
        $bw.Write([Byte]$dim)
        $bw.Write([Byte]0)
        $bw.Write([Byte]0)
        $bw.Write([UInt16]1)
        $bw.Write([UInt16]32)
        $bw.Write([UInt32]$data.Length)
        $bw.Write([UInt32]$offset)
        $offset += $data.Length
    }
    foreach ($entry in $items) {
        $bw.Write([byte[]]$entry[1])
    }
    $bw.Flush()
    $dir = Split-Path $target
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    [System.IO.File]::WriteAllBytes($target, $out.ToArray())
    Write-Output ('ICO written: ' + $target + ' (' + (Get-Item $target).Length + ' bytes)')
}

$root = 'C:\Users\ballb\Documents\Codex\2026-09-04\files-pasted-by-the-user-senior\outputs\MyTube'
$sizes = @(16, 24, 32, 48, 64, 128, 256)

$mainPayloads = @()
$musicPayloads = @()
foreach ($s in $sizes) {
    $main = New-YouTubeBitmap $s
    $music = New-MusicBitmap $s
    if ($s -ge 128) {
        $ms1 = New-Object System.IO.MemoryStream
        $main.Save($ms1, [System.Drawing.Imaging.ImageFormat]::Png)
        $mainPayloads += ,@($s, $ms1.ToArray())
        $ms2 = New-Object System.IO.MemoryStream
        $music.Save($ms2, [System.Drawing.Imaging.ImageFormat]::Png)
        $musicPayloads += ,@($s, $ms2.ToArray())
    }
    else {
        $mainPayloads += ,@($s, (ConvertTo-IcoBmpPayload $main))
        $musicPayloads += ,@($s, (ConvertTo-IcoBmpPayload $music))
    }
    if ($s -eq 256) {
        New-Item -ItemType Directory -Force -Path "$root\docs" | Out-Null
        $main.Save("$root\docs\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
        $music.Save("$root\docs\music-icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
    }
    $main.Dispose()
    $music.Dispose()
}

Write-Ico $mainPayloads "$root\src\MyTube\Resources\Branding\MyTube.ico"
Write-Ico $musicPayloads "$root\src\MyTubeMusic\Resources\app.ico"
Write-Output ('PNG written: ' + "$root\docs\icon.png")
Write-Output ('PNG written: ' + "$root\docs\music-icon.png")

# Hero banner: both apps in identical rounded tiles (GitHub-dark background),
# labels underneath, a plus sign between them.
$bannerW = 1280
$bannerH = 470
$banner = New-Object System.Drawing.Bitmap($bannerW, $bannerH)
$g = [System.Drawing.Graphics]::FromImage($banner)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.Clear([System.Drawing.Color]::FromArgb(255, 13, 17, 23))

$tile = 280
$gap = 56
$tileY = 36
$tile1X = ([int]($bannerW / 2)) - $tile - [int]($gap / 2)
$tile2X = ([int]($bannerW / 2)) + [int]($gap / 2)
$tileRadius = 56

function New-TilePath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc($x, $y, 2 * $r, 2 * $r, 180, 90)
    $p.AddArc($x + $w - 2 * $r, $y, 2 * $r, 2 * $r, 270, 90)
    $p.AddArc($x + $w - 2 * $r, $y + $h - 2 * $r, 2 * $r, 2 * $r, 0, 90)
    $p.AddArc($x, $y + $h - 2 * $r, 2 * $r, 2 * $r, 90, 90)
    $p.CloseFigure()
    return $p
}

$tileFill = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 26, 31, 39))
$tileBorder = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 42, 47, 58), 2)

$p1 = New-TilePath $tile1X $tileY $tile $tile $tileRadius
$g.FillPath($tileFill, $p1)
$g.DrawPath($tileBorder, $p1)
$p2 = New-TilePath $tile2X $tileY $tile $tile $tileRadius
$g.FillPath($tileFill, $p2)
$g.DrawPath($tileBorder, $p2)

$logoMain = New-YouTubeBitmap 200
$logoMusic = New-MusicBitmap 200
$g.DrawImage($logoMain, ($tile1X + 40), ($tileY + 40), 200, 200)
$g.DrawImage($logoMusic, ($tile2X + 40), ($tileY + 40), 200, 200)

$plusFont = New-Object System.Drawing.Font('Segoe UI', 40, [System.Drawing.FontStyle]::Bold)
$plusBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 110, 118, 129))
$plusFormat = New-Object System.Drawing.StringFormat
$plusFormat.Alignment = [System.Drawing.StringAlignment]::Center
$plusFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$plusRect = New-Object System.Drawing.RectangleF(($tile1X + $tile), $tileY, $gap, $tile)
$g.DrawString('+', $plusFont, $plusBrush, $plusRect, $plusFormat)

$labelFont = New-Object System.Drawing.Font('Segoe UI', 26, [System.Drawing.FontStyle]::Bold)
$labelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 244, 245, 247))
$labelY = $tileY + $tile + 24
$labelRect1 = New-Object System.Drawing.RectangleF(($tile1X - 60), $labelY, ($tile + 120), 60)
$labelRect2 = New-Object System.Drawing.RectangleF(($tile2X - 60), $labelY, ($tile + 120), 60)
$g.DrawString('MyTube', $labelFont, $labelBrush, $labelRect1, $plusFormat)
$g.DrawString('YouTube Music', $labelFont, $labelBrush, $labelRect2, $plusFormat)

$banner.Save("$root\docs\hero.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$banner.Dispose()
Write-Output ('Hero written: ' + "$root\docs\hero.png")
