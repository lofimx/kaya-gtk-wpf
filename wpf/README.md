# Kaya for Windows (WPF)

A bookmarking and notes app with server sync. WPF port of the GTK version, built with .NET 9.

## Prerequisites

1. **Install .NET 9 SDK** from https://dotnet.microsoft.com/download/dotnet/9.0

   Verify installation:
   ```powershell
   dotnet --version
   ```

2. **Enable PowerShell script execution** (run PowerShell as Administrator):
   ```powershell
   Set-ExecutionPolicy RemoteSigned
   ```

## Build and Run

```powershell
.\build.ps1 build     # Build the solution
.\build.ps1 test      # Run all tests
.\build.ps1 run       # Launch the app
.\build.ps1 clean     # Clean build artifacts
.\build.ps1 publish   # Publish a release build
```

Or use `dotnet` commands directly:

```powershell
dotnet build
dotnet test
dotnet run --project src/Kaya.Wpf
```

## Data Storage

All data is stored in `%USERPROFILE%\.kaya\`:

| Directory | Contents |
|-----------|----------|
| `.kaya/anga/` | Bookmarks (`.url`) and notes (`.md`) |
| `.kaya/meta/` | Metadata files (`.toml`) |
| `.kaya/words/` | Vocabulary/word sync data |
| `.kaya/settings.json` | App settings (server URL, email, sync state) |

Passwords are stored in Windows Credential Manager, not on disk.

## Project Structure

```
wpf/
├── src/
│   ├── Kaya.Core/        # Models and services (no UI dependency)
│   └── Kaya.Wpf/         # WPF application
├── tests/
│   └── Kaya.Tests/       # xUnit tests
└── build.ps1
```

## Theming

The app uses the .NET 9 Fluent theme with `ThemeMode="System"`, which automatically follows the Windows dark/light mode setting.
