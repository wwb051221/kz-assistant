# ============================================================
#  start-panel.ps1 - 启动本地服务并在副屏打开仪表板
#  用法： start-panel.ps1 [-DryRun]
# ============================================================
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8123

function Test-Port([int]$p) {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', $p)
    $c.Close()
    return $true
  } catch { return $false }
}

# ---- 1. 本地静态服务 ----
if (Test-Port $port) {
  Write-Output "server already running on $port"
} else {
  $py = Get-Command python -ErrorAction SilentlyContinue
  if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
  if (-not $py) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
      "没有找到 Python。请安装 Python 3，或改用任意静态服务器把本目录挂到 http://127.0.0.1:8123/",
      "空战助手") | Out-Null
    exit 1
  }
  if ($DryRun) {
    Write-Output "DRYRUN: $($py.Source) -m http.server $port --directory $root"
  } else {
    Start-Process -FilePath $py.Source `
      -ArgumentList '-m', 'http.server', "$port", '--bind', '127.0.0.1', '--directory', $root `
      -WindowStyle Hidden
    Start-Sleep -Milliseconds 900
  }
}

# ---- 2. 选副屏 ----
Add-Type -AssemblyName System.Windows.Forms
$screens = [System.Windows.Forms.Screen]::AllScreens
$target = $screens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $target) { $target = [System.Windows.Forms.Screen]::PrimaryScreen }
$b = $target.Bounds

# ---- 3. 浏览器 ----
$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$url = "http://127.0.0.1:$port/"

if (-not $browser) {
  if ($DryRun) { Write-Output "DRYRUN: no chrome/edge, would open $url in default browser"; exit 0 }
  Start-Process $url
  exit 0
}

$profileDir = Join-Path $env:LOCALAPPDATA 'kongzhan-zhushou\browser'
if (-not $DryRun) { New-Item -ItemType Directory -Force -Path $profileDir | Out-Null }

if ($DryRun) {
  Write-Output "DRYRUN: $browser"
  Write-Output "   url=$url  pos=$($b.X),$($b.Y)  size=$($b.Width)x$($b.Height)"
  exit 0
}

Start-Process -FilePath $browser -ArgumentList @(
  "--app=$url",
  "--window-position=$($b.X),$($b.Y)",
  "--window-size=$($b.Width),$($b.Height)",
  '--start-fullscreen',
  "--user-data-dir=$profileDir",
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=Translate,MediaRouter'
)
