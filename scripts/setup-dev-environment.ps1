<#
.SYNOPSIS
    Prepare the local Trading Research Lab development environment safely.

.DESCRIPTION
    This script validates the locked desktop toolchain, creates or reuses the
    Python 3.14.7 virtual environment, installs only declared project
    dependencies, builds the existing Obsidian plugin, and creates an idempotent
    junction from the dedicated development vault to the authoritative plugin
    source. It never searches for or modifies personal Obsidian vaults.

    It does not start a server, configure HTTP, add telemetry, or implement any
    Trading Research Lab feature.
#>

[CmdletBinding()]
param(
    [string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$DevelopmentVault = (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'vaults\TRL-Dev-Vault')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Require-Command {
    param([Parameter(Mandatory)][string]$Name)

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        throw "Required command '$Name' was not found on PATH. Install the approved prerequisite and run this script again."
    }
    return $command
}

function Get-NormalizedPath {
    param([Parameter(Mandatory)][string]$Path)

    return [IO.Path]::GetFullPath($Path).TrimEnd('\').ToUpperInvariant()
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory)][string]$Label,
        [Parameter(Mandatory)][string]$Executable,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory = $RepositoryRoot
    )

    Push-Location $WorkingDirectory
    try {
        & $Executable @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "$Label failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Require-Path {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Description)

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Description does not exist: $Path"
    }
}

function Get-JunctionTarget {
    param([Parameter(Mandatory)][System.IO.FileSystemInfo]$Item)

    if ($Item.LinkType -ne 'Junction' -or $null -eq $Item.Target) {
        return $null
    }
    return @($Item.Target)[0]
}

$repository = Get-NormalizedPath $RepositoryRoot
$vault = Get-NormalizedPath $DevelopmentVault
$researchCore = Join-Path $repository 'research-core'
$pluginSource = Join-Path $repository 'plugin'
$venv = Join-Path $researchCore '.venv'
$venvPython = Join-Path $venv 'Scripts\python.exe'
$vaultPluginParent = Join-Path $vault '.obsidian\plugins'
$pluginDestination = Join-Path $vaultPluginParent 'trading-research-lab'

Write-Host 'Trading Research Lab development environment'
Write-Host "Repository: $repository"
Write-Host "Development vault: $vault"

Require-Path -Path $repository -Description 'Repository root'
Require-Path -Path $researchCore -Description 'Research Core directory'
Require-Path -Path $pluginSource -Description 'Plugin source directory'
Require-Path -Path $vault -Description 'Approved development vault'
Require-Path -Path $vaultPluginParent -Description 'Development-vault plugin parent directory'

$systemNode = Join-Path $env:ProgramFiles 'nodejs\node.exe'
if (Test-Path -LiteralPath $systemNode -PathType Leaf) {
    $nodeExecutable = $systemNode
}
else {
    $nodeExecutable = (Require-Command -Name 'node').Source
}
$systemNpm = Join-Path (Split-Path -Parent $nodeExecutable) 'npm.cmd'
if (Test-Path -LiteralPath $systemNpm -PathType Leaf) {
    $npmExecutable = $systemNpm
}
else {
    $npmExecutable = (Require-Command -Name 'npm').Source
}
$pyCommand = Get-Command 'py' -ErrorAction SilentlyContinue
if ($null -ne $pyCommand) {
    $pyExecutable = $pyCommand.Source
}
else {
    $windowsAppsPy = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\py.exe'
    if (-not (Test-Path -LiteralPath $windowsAppsPy -PathType Leaf)) {
        throw "Required command 'py' was not found on PATH or in the current user's WindowsApps directory. Install Python 3.14.7 and run this script again."
    }
    $pyExecutable = $windowsAppsPy
}
$git = Require-Command -Name 'git'

$nodeVersion = (& $nodeExecutable --version).Trim()
if ($nodeVersion -notmatch '^v24\.\d+\.\d+$') {
    throw "Node.js must be on the approved Node 24 line; found '$nodeVersion'."
}
$npmVersion = (& $npmExecutable --version).Trim()
$pythonVersion = (& $pyExecutable -3.14 --version).Trim()
if ($pythonVersion -ne 'Python 3.14.7') {
    throw "py -3.14 must resolve exactly Python 3.14.7; found '$pythonVersion'."
}
$gitVersion = (& $git.Source --version).Trim()

# Keep npm child processes on the validated system Node runtime for this script
# invocation only; this does not change the user's persistent environment.
$env:Path = "$(Split-Path -Parent $nodeExecutable);$env:Path"

Write-Host "Node.js: $nodeVersion"
Write-Host "npm: $npmVersion"
Write-Host "Python: $pythonVersion"
Write-Host "Git: $gitVersion"

if (Test-Path -LiteralPath $venv) {
    if (-not (Test-Path -LiteralPath $venvPython -PathType Leaf)) {
        throw "Existing virtual environment is invalid because its interpreter is missing: $venvPython"
    }
    $venvVersion = (& $venvPython --version).Trim()
    if ($venvVersion -ne 'Python 3.14.7') {
        throw "Existing virtual environment uses '$venvVersion', not Python 3.14.7. It was not replaced. Review it manually."
    }
    Write-Host "Python venv: reusing valid $venvVersion environment"
}
else {
    Write-Host "Python venv: creating $venv"
    Invoke-Checked -Label 'Python virtual-environment creation' -Executable $pyExecutable -Arguments @('-3.14', '-m', 'venv', $venv)
    $venvVersion = (& $venvPython --version).Trim()
    if ($venvVersion -ne 'Python 3.14.7') {
        throw "New virtual environment reports '$venvVersion', not Python 3.14.7. Review it manually."
    }
}

$researchCoreWithDev = "${researchCore}[dev]"
Write-Host 'Python packages: resolving declared Research Core and development-test dependencies for Python 3.14.7'
Invoke-Checked -Label 'Python dependency compatibility resolution' -Executable $venvPython -Arguments @('-m', 'pip', 'install', '--dry-run', '--editable', $researchCoreWithDev) -WorkingDirectory $researchCore
Write-Host 'Python packages: installing declared Research Core and development-test dependencies'
Invoke-Checked -Label 'Python dependency installation' -Executable $venvPython -Arguments @('-m', 'pip', 'install', '--editable', $researchCoreWithDev) -WorkingDirectory $researchCore
Invoke-Checked -Label 'Python package integrity check' -Executable $venvPython -Arguments @('-m', 'pip', 'check') -WorkingDirectory $researchCore
$verificationScript = @'
import openpyxl
import pyarrow
import pytest
import trading_research_core

print("openpyxl=" + openpyxl.__version__)
print("pyarrow=" + pyarrow.__version__)
print("pytest=" + pytest.__version__)
print("trading_research_core import=OK")
'@

$verificationScript | & $venvPython -

if ($LASTEXITCODE -ne 0) {
    throw "Python import verification failed with exit code $LASTEXITCODE."
}

$lockfile = Join-Path $pluginSource 'package-lock.json'
if (Test-Path -LiteralPath $lockfile -PathType Leaf) {
    Write-Host 'npm packages: installing from existing package-lock.json'
    Invoke-Checked -Label 'npm deterministic installation' -Executable $npmExecutable -Arguments @('ci') -WorkingDirectory $pluginSource
}
else {
    Write-Host 'npm packages: no lockfile exists; creating package-lock.json from declared dependencies'
    Invoke-Checked -Label 'npm dependency installation' -Executable $npmExecutable -Arguments @('install') -WorkingDirectory $pluginSource
}

Write-Host 'Plugin build: running the declared TypeScript and esbuild build'
Invoke-Checked -Label 'Plugin build' -Executable $npmExecutable -Arguments @('run', 'build') -WorkingDirectory $pluginSource
foreach ($artifact in @('manifest.json', 'main.js', 'styles.css')) {
    $artifactPath = Join-Path $pluginSource $artifact
    if (-not (Test-Path -LiteralPath $artifactPath -PathType Leaf)) {
        throw "Plugin build did not produce required artifact: $artifactPath"
    }
}

$destinationItem = Get-Item -LiteralPath $pluginDestination -Force -ErrorAction SilentlyContinue
if ($null -eq $destinationItem) {
    Write-Host 'Plugin junction plan'
    Write-Host "Source: $pluginSource"
    Write-Host "Destination: $pluginDestination"
    Write-Host 'Operation: Create Windows directory junction from the vault plugin path to the authoritative repository plugin source.'
    New-Item -ItemType Junction -Path $pluginDestination -Target $pluginSource | Out-Null
}
else {
    $target = Get-JunctionTarget -Item $destinationItem
    if ($null -eq $target) {
        throw "Plugin destination already exists and is not a junction. No files were changed: $pluginDestination"
    }
    if ((Get-NormalizedPath $target) -ne (Get-NormalizedPath $pluginSource)) {
        throw "Plugin destination is a junction to a different target. No files were changed. Destination: $pluginDestination Target: $target"
    }
    Write-Host 'Plugin junction: existing correct junction reused.'
}

Write-Host ''
Write-Host 'Trading Research Lab development environment'
Write-Host 'Node.js            OK'
Write-Host 'npm                OK'
Write-Host 'Python 3.14.7      OK'
Write-Host 'Git                OK'
Write-Host 'Python venv        OK'
Write-Host 'Python packages    OK'
Write-Host 'npm packages       OK'
Write-Host 'Plugin build       OK'
Write-Host 'Dev vault          OK'
Write-Host 'Plugin junction    OK'
Write-Host ''
Write-Host 'Ready for Obsidian.'
Write-Host '1. Open C:\DEV\vaults\TRL-Dev-Vault as an Obsidian vault.'
Write-Host '2. Open Settings -> Community plugins.'
Write-Host '3. Enable Community plugins if required.'
Write-Host '4. Locate and enable Trading Research Lab.'
Write-Host '5. If it does not appear, reload Obsidian and recheck the plugin directory/build outputs.'

