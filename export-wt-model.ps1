# ============================================================
#  export-wt-model.ps1 — 从战雷游戏文件里导出一个机体模型
#
#  用法：
#    powershell -ExecutionPolicy Bypass -File export-wt-model.ps1 -Name j_16
#    powershell -ExecutionPolicy Bypass -File export-wt-model.ps1 -Name f_16c_block_50 -Label "F-16C"
#
#  它会：
#    1. 自动找游戏目录（Steam 默认路径，或 -Game 指定）
#    2. 用 wt-unpack 从 air.grp 导出该机体的 LOD2 网格到 glTF
#    3. 剥离贴图（保留灰色材质，适合 MFD 显示）
#    4. 拷进面板的 models/wt/<name>/ 并更新 models/manifest.json
# ============================================================
param(
  [Parameter(Mandatory = $true)][string]$Name,
  [string]$Label = "",
  [string]$Game = "",
  [int]$Lod = 2
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path   # 项目根目录
$tools = Join-Path $root 'tools\wt-unpack.exe'

# 1. 找游戏目录
if (-not $Game) {
  $cands = @(
    "D:\SteamLibrary\steamapps\common\War Thunder",
    "C:\Program Files (x86)\Steam\steamapps\common\War Thunder",
    "C:\SteamLibrary\steamapps\common\War Thunder"
  )
  $Game = $cands | Where-Object { Test-Path "$_\content\base\res\aircrafts\air.grp" } | Select-Object -First 1
}
if (-not $Game) { Write-Error "找不到游戏目录，请用 -Game 指定（含 content\base\res\aircrafts\air.grp）" }
if (-not (Test-Path $tools)) { Write-Error "找不到 tools\wt-unpack.exe" }
Write-Host "游戏目录：$Game"

$pack = "$Game\content\base\res\aircrafts\air.grp"
if (-not (Test-Path $pack)) { Write-Error "找不到 air.grp" }

# 2. 导出
$tmp = Join-Path $env:TEMP ("wt-model-" + $Name)
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Write-Host "导出 $Name (LOD $Lod) ..."
& $tools model --game $Game --out $tmp --lod $Lod $pack $Name
$gltf = Get-ChildItem $tmp -Filter '*.gltf' | Select-Object -First 1
if (-not $gltf) { Write-Error "导出失败，模型名可能不对（用 wt-unpack grp air.grp 列出）" }

# 3. 剥离贴图 + 灰色材质
$py = @"
import json, io, os
d = r'$tmp'
g = json.load(io.open(r'$($gltf.FullName)', encoding='utf-8'))
g.pop('images', None); g.pop('textures', None); g.pop('samplers', None)
for m in g.get('materials', []):
    pbr = m.get('pbrMetallicRoughness', {})
    for k in ('baseColorTexture','metallicRoughnessTexture','normalTexture','occlusionTexture','emissiveTexture'):
        pbr.pop(k, None); m.pop(k, None)
    pbr['baseColorFactor'] = [0.46, 0.48, 0.47, 1.0]
    pbr['metallicFactor'] = 0.3
    pbr['roughnessFactor'] = 0.6
    m['pbrMetallicRoughness'] = pbr
    m.pop('extensions', None)
io.open(r'$($gltf.FullName)', 'w', encoding='utf-8').write(json.dumps(g, separators=(',', ':')))
for f in os.listdir(d):
    if f.lower().endswith(('.png', '.jpg', '.jpeg')):
        os.remove(os.path.join(d, f))
"@
$pytmp = Join-Path $env:TEMP 'wt-slim.py'
[IO.File]::WriteAllText($pytmp, $py, (New-Object Text.UTF8Encoding($false)))
python $pytmp

# 4. 拷进面板 + 更新清单
$dstDir = Join-Path $root "models\wt\$Name"
Remove-Item $dstDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
Copy-Item "$tmp\*" $dstDir -Recurse -Force

$label = if ($Label) { $Label } else { $Name.ToUpper() }
$manifest = Join-Path $root 'models\manifest.json'
$list = @()
if (Test-Path $manifest) { $list = Get-Content $manifest -Raw | ConvertFrom-Json }
$list = @($list | Where-Object { $_.file -notlike "models/wt/$Name/*" })
$list += [pscustomobject]@{ name = $label; file = "models/wt/$Name/$($gltf.Name)" }
$list | ConvertTo-Json | Set-Content $manifest -Encoding UTF8

Write-Host ""
Write-Host "完成：$dstDir"
Write-Host "已更新：$manifest"
Write-Host "重启面板（或按 S → 机模下拉选择）即可看到。"
Write-Host "如果朝向不对：设置 → 朝向 滑杆调整。"



