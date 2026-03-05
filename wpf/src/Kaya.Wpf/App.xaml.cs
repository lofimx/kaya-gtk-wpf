using System.Windows;
using Kaya.Core.Services;

namespace Kaya.Wpf;

public partial class App : Application
{
    private SyncManager? _syncManager;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var settingsService = new SettingsService();
        var credentialService = new CredentialService();
        _syncManager = new SyncManager(settingsService, credentialService);
        _syncManager.Start();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _syncManager?.Stop();
        _syncManager?.Dispose();
        base.OnExit(e);
    }
}
