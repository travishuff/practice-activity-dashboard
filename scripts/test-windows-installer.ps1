param(
  [Parameter(Mandatory = $true)]
  [string]$InstallerPath
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Wait-ForCondition {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Description,

    [Parameter(Mandatory = $true)]
    [scriptblock]$Condition,

    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $result = & $Condition
    if ($result) {
      return $result
    }
    Start-Sleep -Seconds 1
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Description"
}

function Get-PracticeActivityUninstallEntry {
  $uninstallKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall"
  if (-not (Test-Path $uninstallKey)) {
    return $null
  }

  Get-ChildItem $uninstallKey |
    Get-ItemProperty |
    Where-Object { $_.DisplayName -eq "Practice Activity" } |
    Select-Object -First 1
}

function Get-PracticeActivityShortcuts {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Paths
  )

  Get-ChildItem `
    -Path $Paths `
    -Filter "Practice Activity.lnk" `
    -File `
    -Recurse `
    -ErrorAction SilentlyContinue
}

$installer = (Resolve-Path $InstallerPath).Path
$packageJson = Get-Content (Join-Path $PSScriptRoot "..\package.json") -Raw |
  ConvertFrom-Json
$expectedVersion = [string]$packageJson.version
$installLocation = $null

Write-Host "Installing $installer"

try {
  $installProcess = Start-Process `
    -FilePath $installer `
    -ArgumentList "--silent" `
    -PassThru `
    -Wait

  if ($installProcess.ExitCode -ne 0) {
    throw "Installer exited with code $($installProcess.ExitCode)"
  }

  $uninstallEntry = Wait-ForCondition `
    -Description "the uninstall registry entry" `
    -Condition { Get-PracticeActivityUninstallEntry }

  if ([string]$uninstallEntry.DisplayVersion -ne $expectedVersion) {
    throw "Installed version $($uninstallEntry.DisplayVersion) does not match $expectedVersion"
  }

  $installLocation = [string]$uninstallEntry.InstallLocation
  if (-not (Test-Path $installLocation -PathType Container)) {
    throw "Install location does not exist: $installLocation"
  }

  $updateExe = Join-Path $installLocation "Update.exe"
  if (-not (Test-Path $updateExe -PathType Leaf)) {
    throw "Squirrel updater was not installed: $updateExe"
  }

  $appExe = Get-ChildItem `
    -Path $installLocation `
    -Filter "Practice Activity.exe" `
    -File `
    -Recurse |
    Where-Object { $_.Directory.Name -like "app-*" } |
    Select-Object -First 1

  if (-not $appExe) {
    throw "Installed application executable was not found"
  }

  $desktop = [Environment]::GetFolderPath("Desktop")
  $programs = [Environment]::GetFolderPath("Programs")
  $shortcutPaths = @($desktop, $programs)
  Wait-ForCondition `
    -Description "the desktop and Start menu shortcuts" `
    -Condition {
      @(Get-PracticeActivityShortcuts -Paths $shortcutPaths).Count -ge 2
    } |
    Out-Null

  Write-Host "Launching $($appExe.FullName)"
  $appProcess = Start-Process `
    -FilePath $appExe.FullName `
    -ArgumentList "--installer-smoke-test" `
    -PassThru `
    -Wait

  if ($appProcess.ExitCode -ne 0) {
    throw "Installed app smoke test exited with code $($appProcess.ExitCode)"
  }

  Write-Host "Uninstalling Practice Activity"
  $uninstallProcess = Start-Process `
    -FilePath $updateExe `
    -ArgumentList @("--uninstall", "--silent") `
    -PassThru `
    -Wait

  if ($uninstallProcess.ExitCode -ne 0) {
    throw "Uninstaller exited with code $($uninstallProcess.ExitCode)"
  }

  Wait-ForCondition `
    -Description "the uninstall registry entry to be removed" `
    -Condition { -not (Get-PracticeActivityUninstallEntry) } |
    Out-Null

  Wait-ForCondition `
    -Description "the installed application to be removed" `
    -Condition { -not (Test-Path $appExe.FullName) } |
    Out-Null

  Wait-ForCondition `
    -Description "the shortcuts to be removed" `
    -Condition {
      @(Get-PracticeActivityShortcuts -Paths $shortcutPaths).Count -eq 0
    } |
    Out-Null

  Write-Host "Windows installer smoke test passed"
} finally {
  $remainingEntry = Get-PracticeActivityUninstallEntry
  if ($remainingEntry) {
    $cleanupUpdateExe = Join-Path $remainingEntry.InstallLocation "Update.exe"
    if (Test-Path $cleanupUpdateExe -PathType Leaf) {
      Write-Host "Cleaning up the test installation"
      Start-Process `
        -FilePath $cleanupUpdateExe `
        -ArgumentList @("--uninstall", "--silent") `
        -Wait `
        -ErrorAction SilentlyContinue
    }
  }
}
