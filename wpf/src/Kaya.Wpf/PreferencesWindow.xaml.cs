using System.Windows;
using Kaya.Core.Services;

namespace Kaya.Wpf;

public partial class PreferencesWindow : Window
{
    private readonly SettingsService _settingsService = new();
    private readonly CredentialService _credentialService = new();
    private bool _isLoading = true;

    public PreferencesWindow()
    {
        InitializeComponent();
        this.ApplyDarkTitleBar();
        LoadSettings();
        _isLoading = false;
        UpdateStatus();
    }

    private void LoadSettings()
    {
        ServerUrlEntry.Text = _settingsService.ServerUrl;
        EmailEntry.Text = _settingsService.Email;

        var password = _credentialService.GetPassword();
        if (!string.IsNullOrEmpty(password))
            PasswordEntry.Password = password;
    }

    private void OnSettingsChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
    {
        if (_isLoading) return;

        _settingsService.ServerUrl = ServerUrlEntry.Text.Trim();
        _settingsService.Email = EmailEntry.Text.Trim();
        UpdateStatus();
    }

    private void OnPasswordChanged(object sender, RoutedEventArgs e)
    {
        if (_isLoading) return;

        var password = PasswordEntry.Password;
        if (string.IsNullOrEmpty(password))
            _credentialService.ClearPassword();
        else
            _credentialService.SetPassword(password);

        UpdateStatus();
    }

    private async void OnForceSync(object sender, RoutedEventArgs e)
    {
        ForceSyncButton.IsEnabled = false;
        SyncStatusText.Text = "Syncing...";

        try
        {
            var syncService = new SyncService(_settingsService, _credentialService);
            var result = await syncService.SyncAsync();

            if (result.Errors.Count > 0)
            {
                var errorMsg = string.Join("\n", result.Errors.Select(err => $"{err.Operation} {err.File}: {err.Error}"));
                SyncStatusText.Text = $"Sync completed with errors:\n{errorMsg}";
            }
            else
            {
                _settingsService.LastSyncSuccess = DateTimeOffset.UtcNow.ToString("o");
                _settingsService.LastSyncError = "";
                UpdateStatus();
            }
        }
        catch (Exception ex)
        {
            SyncStatusText.Text = $"Sync failed: {ex.Message}";
        }
        finally
        {
            ForceSyncButton.IsEnabled = true;
        }
    }

    private void UpdateStatus()
    {
        var lastError = _settingsService.LastSyncError;
        if (!string.IsNullOrEmpty(lastError))
        {
            SyncStatusText.Text = $"Error: {lastError}";
            return;
        }

        if (!_settingsService.IsCustomServerConfigured())
        {
            SyncStatusText.Text = "Sync disabled (default server not yet available)";
            return;
        }

        if (string.IsNullOrEmpty(_settingsService.Email) || string.IsNullOrEmpty(_credentialService.GetPassword()))
        {
            SyncStatusText.Text = "Not configured \u2014 enter email and password";
            return;
        }

        var lastSuccess = _settingsService.LastSyncSuccess;
        if (!string.IsNullOrEmpty(lastSuccess))
        {
            if (DateTimeOffset.TryParse(lastSuccess, out var dt))
                SyncStatusText.Text = $"Last sync: {dt.ToLocalTime():g}";
            else
                SyncStatusText.Text = $"Last sync: {lastSuccess}";
            return;
        }

        SyncStatusText.Text = $"Ready to sync with {_settingsService.ServerUrl}";
    }
}
