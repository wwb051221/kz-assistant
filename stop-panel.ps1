# ============================================================
#  stop-panel.ps1 — 关闭仪表板窗口与本地服务
# ============================================================
$ErrorActionPreference = 'SilentlyContinue'

Get-CimInstance Win32_Process |
  Where-Object { $_.CommandLine -like '*kongzhan-zhushou\browser*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Get-NetTCPConnection -LocalPort 8123 -State Listen |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

