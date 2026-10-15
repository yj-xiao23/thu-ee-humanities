# 把根目录的 4 张原图压缩、去元数据，输出到 assets/photos/
# 公开页面用图的两个原则：① 不留 EXIF（可能含定位与设备信息）② 控制体积
Add-Type -AssemblyName System.Drawing

$src = 'F:\DSH\人文组网页'
$dst = Join-Path $src 'assets\photos'
if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst -Force | Out-Null }

# 文件名 → 语义化名称（按内容对应）
$map = [ordered]@{
  '523ee465923fb5a6107212f3912ef5fd.jpg' = 'group.jpg'      # 10 人全员合影
  'dd510d0fda73ea29ab74b4788a28cd30.jpg' = 'debate.jpg'     # 清锋明辩备赛
  'a21a5600627b202ac25918ea230faccb.jpg' = 'meeting.jpg'    # 日常例会 / 读书沙龙
  '496c90b2f3698ded20dae592710846bf.jpg' = 'community.jpg'  # 社区共读
}

# 编码器：JPEG，质量 82
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 82L)

foreach ($k in $map.Keys) {
  $in = Join-Path $src $k
  $out = Join-Path $dst $map[$k]
  if (-not (Test-Path $in)) { "跳过（不存在）: $k"; continue }

  $img = [System.Drawing.Image]::FromFile($in)
  try {
    # 长边限制到 1600px
    $max = 1600.0
    $scale = [Math]::Min(1.0, $max / [Math]::Max($img.Width, $img.Height))
    $w = [int][Math]::Round($img.Width * $scale)
    $h = [int][Math]::Round($img.Height * $scale)

    # 用新位图重画 —— 这样 EXIF 不会被带过去（像素重采样后元数据自然丢弃）
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.DrawImage($img, 0, 0, $w, $h)
    } finally { $g.Dispose() }

    # 清掉所有属性项（保险起见，Bitmap 本身可能继承）
    foreach ($p in @($bmp.PropertyIdList)) { try { $bmp.RemovePropertyItem($p) } catch { } }
    $bmp.Save($out, $codec, $encParams)
    $bmp.Dispose()

    $oldKB = [Math]::Round((Get-Item $in).Length / 1KB)
    $newKB = [Math]::Round((Get-Item $out).Length / 1KB)
    "{0,-14} {1,5}x{2,-5} → {3,4}x{4,-5}  {5,6} KB → {6,5} KB" -f $map[$k], $img.Width, $img.Height, $w, $h, $oldKB, $newKB
  } finally { $img.Dispose() }
}

"=== 校验输出：确认没有 EXIF ==="
foreach ($f in Get-ChildItem $dst -File) {
  $i = [System.Drawing.Image]::FromFile($f.FullName)
  $ids = $i.PropertyIdList
  "  " + $f.Name.PadRight(14) + " " + $i.Width + "x" + $i.Height + "  剩余属性项: " + $(if ($ids) { ($ids | Measure-Object).Count } else { 0 })
  $i.Dispose()
}
$total = (Get-ChildItem $dst -File | Measure-Object Length -Sum).Sum
"  合计: " + [Math]::Round($total/1KB) + " KB"
