param(
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$venvDir = Join-Path $repoRoot ".venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Creating virtual environment in .venv"
    python -m venv $venvDir
}

if (-not $SkipInstall) {
    Write-Host "Installing test dependencies"
    & $venvPython -m pip install -r (Join-Path $repoRoot "requirements_test.txt")
}

Write-Host "Running pytest"
& $venvPython -m pytest -q --tb=short
