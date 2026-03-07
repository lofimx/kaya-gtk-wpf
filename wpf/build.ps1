param([string]$Command = "build")

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot
try {
    switch ($Command) {
        "build"   { dotnet build }
        "test"    { dotnet test }
        "run"     { $ErrorActionPreference = "Continue"; dotnet run --project src/Kaya.Wpf 2>&1 }
        "clean"   { dotnet clean }
        "publish" { dotnet publish src/Kaya.Wpf -c Release }
        default   { Write-Error "Unknown command: $Command. Use build, test, run, clean, or publish." }
    }
} finally {
    Pop-Location
}
