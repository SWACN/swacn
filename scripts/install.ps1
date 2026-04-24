$Cyan = "Cyan"
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"

Write-Host "   _____ _      __ ___   _________   __" -ForegroundColor $Cyan
Write-Host "  / ___/| | /| / // _ | / ___/ |/ /" -ForegroundColor $Cyan
Write-Host "  \__ \ | |/ |/ // __ |/ /__ /    / " -ForegroundColor $Cyan
Write-Host " ___/ / |__/|__//_/ |_|\___//_/|_/  " -ForegroundColor $Cyan
Write-Host "                                      "
Write-Host "  SWACN CLI Installer (Windows)       " -ForegroundColor $Cyan
Write-Host ""
$Repo = "karthikeyjoshi/swacn"
$AssetName = "swacn-windows-x86_64.exe"

Write-Host "Fetching latest release from $Repo..." -NoNewline
Write-Host " "

try {
    # Get the latest release from GitHub API
    $ReleaseUrl = "https://api.github.com/repos/$Repo/releases/latest"
    $ReleaseData = Invoke-RestMethod -Uri $ReleaseUrl -UseBasicParsing

    $AssetUrl = $null
    foreach ($Asset in $ReleaseData.assets) {
        if ($Asset.name -eq $AssetName) {
            $AssetUrl = $Asset.browser_download_url
            break
        }
    }

    if ([string]::IsNullOrEmpty($AssetUrl)) {
        Write-Host "`nError: Could not find release asset for $AssetName." -ForegroundColor Red
        Write-Host "Please check https://github.com/$Repo/releases" -ForegroundColor Red
        exit 1
    }

    Write-Host "Downloading from GitHub..." -ForegroundColor Cyan

    $InstallDir = Join-Path -Path $env:LOCALAPPDATA -ChildPath "swacn"
    if (-not (Test-Path -Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir | Out-Null
    }

    $DestPath = Join-Path -Path $InstallDir -ChildPath "swacn.exe"

    Invoke-WebRequest -Uri $AssetUrl -OutFile $DestPath -UseBasicParsing

    Write-Host "`n✔ Successfully installed swacn to $DestPath" -ForegroundColor Green

    # Add to user PATH if it doesn't exist
    $UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($UserPath -notlike "*$InstallDir*") {
        Write-Host "`nAdding $InstallDir to your PATH..." -ForegroundColor Yellow
        $NewPath = "$UserPath;$InstallDir"
        [Environment]::SetEnvironmentVariable("PATH", $NewPath, "User")
        
        Write-Host "`n╭──────────────────────────────────────────╮" -ForegroundColor Yellow
        Write-Host "│  ACTION REQUIRED: Restart your terminal  │" -ForegroundColor Yellow
        Write-Host "╰──────────────────────────────────────────╯" -ForegroundColor Yellow
        Write-Host "The PATH was updated, but you must open a NEW PowerShell or Command Prompt to use 'swacn'."
        Write-Host ""
    } else {
        Write-Host "`nInstallation complete! Try running 'swacn' in your terminal.`n" -ForegroundColor Green
    }

} catch {
    Write-Host "An error occurred during installation: $_" -ForegroundColor Red
    exit 1
}
