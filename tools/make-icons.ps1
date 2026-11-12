# Draws the פנקס app icon (a banknote with a gold seal on money green) at every size iOS/Android need.
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\app\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function Hex($h, $a = 255) {
  $c = [System.Drawing.ColorTranslator]::FromHtml($h)
  return [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B)
}

function RoundRectPath($x, $y, $w, $h, $r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Draw($size, $file, $scale = 1.0) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $k = $size / 1024.0

  # money-green background with a soft diagonal depth
  $bgRect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush $bgRect, (Hex '#165440'), (Hex '#0B3024'), 60
  $g.FillRectangle($bg, $bgRect)

  $g.TranslateTransform($size / 2, $size / 2)
  $g.ScaleTransform($k * $scale, $k * $scale)
  $g.TranslateTransform(-512, -512)

  # back note, rotated
  $g.TranslateTransform(512, 512); $g.RotateTransform(-9); $g.TranslateTransform(-512, -512)
  $p = RoundRectPath 196 318 632 388 34
  $g.FillPath((New-Object System.Drawing.SolidBrush (Hex '#B9C7B5')), $p)
  $g.ResetTransform()
  $g.TranslateTransform($size / 2, $size / 2)
  $g.ScaleTransform($k * $scale, $k * $scale)
  $g.TranslateTransform(-512, -512)

  # front note
  $front = RoundRectPath 176 356 672 400 34
  $g.FillPath((New-Object System.Drawing.SolidBrush (Hex '#F3F0E6')), $front)
  # engraved inner frame
  $framePen = New-Object System.Drawing.Pen (Hex '#0F4A35'), 7
  $inner = RoundRectPath 206 386 612 340 20
  $g.DrawPath($framePen, $inner)

  # guilloché-ish waves on the left side of the note
  $wavePen = New-Object System.Drawing.Pen (Hex '#0F4A35' 110), 5
  for ($row = 0; $row -lt 5; $row++) {
    $pts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
    for ($x = 236; $x -le 520; $x += 6) {
      $y = 456 + $row * 50 + 12 * [Math]::Sin(($x / 30.0) + $row * 0.8)
      $pts.Add((New-Object System.Drawing.PointF $x, $y))
    }
    $g.DrawLines($wavePen, $pts.ToArray())
  }

  # gold seal on the right (RTL reading start)
  $gold = New-Object System.Drawing.SolidBrush (Hex '#D9B65C')
  $g.FillEllipse($gold, 584, 446, 220, 220)
  $ring = New-Object System.Drawing.Pen (Hex '#8A6A1C'), 8
  $g.DrawEllipse($ring, 610, 472, 168, 168)
  $dot = New-Object System.Drawing.SolidBrush (Hex '#8A6A1C')
  for ($i = 0; $i -lt 12; $i++) {
    $a = $i * [Math]::PI / 6
    $cx = 694 + 58 * [Math]::Cos($a); $cy = 556 + 58 * [Math]::Sin($a)
    $g.FillEllipse($dot, $cx - 9, $cy - 9, 18, 18)
  }

  $g.Dispose()
  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Draw 180 'apple-touch-icon.png'
Draw 192 'icon-192.png'
Draw 512 'icon-512.png'
Draw 512 'icon-maskable-512.png' 0.8
Draw 1024 'icon-1024.png'
Draw 32 'favicon-32.png'
Write-Output 'icons done'
