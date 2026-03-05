using System.Text.Json;

namespace Kaya.Core.Services;

public class SettingsService
{
    private const string DefaultServerUrl = "https://kaya.town";
    private static readonly string SettingsPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".kaya", "settings.json");

    private SettingsData _data;

    public event Action? Changed;

    public SettingsService()
    {
        _data = Load();
    }

    public string ServerUrl
    {
        get => string.IsNullOrEmpty(_data.ServerUrl) ? DefaultServerUrl : _data.ServerUrl;
        set { _data.ServerUrl = value; Save(); Changed?.Invoke(); }
    }

    public string Email
    {
        get => _data.Email ?? "";
        set { _data.Email = value; Save(); Changed?.Invoke(); }
    }

    public bool SyncEnabled
    {
        get => _data.SyncEnabled;
        set { _data.SyncEnabled = value; Save(); Changed?.Invoke(); }
    }

    public string LastSyncError
    {
        get => _data.LastSyncError ?? "";
        set { _data.LastSyncError = value; Save(); Changed?.Invoke(); }
    }

    public string LastSyncSuccess
    {
        get => _data.LastSyncSuccess ?? "";
        set { _data.LastSyncSuccess = value; Save(); Changed?.Invoke(); }
    }

    public bool IsCustomServerConfigured()
    {
        return ServerUrl != DefaultServerUrl && ServerUrl.Length > 0;
    }

    public bool ShouldSync()
    {
        return IsCustomServerConfigured() && !string.IsNullOrEmpty(Email);
    }

    private SettingsData Load()
    {
        if (!File.Exists(SettingsPath))
            return new SettingsData();

        var json = File.ReadAllText(SettingsPath);
        return JsonSerializer.Deserialize<SettingsData>(json) ?? new SettingsData();
    }

    private void Save()
    {
        var dir = Path.GetDirectoryName(SettingsPath)!;
        Directory.CreateDirectory(dir);
        var json = JsonSerializer.Serialize(_data, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(SettingsPath, json);
    }

    private class SettingsData
    {
        public string? ServerUrl { get; set; }
        public string? Email { get; set; }
        public bool SyncEnabled { get; set; }
        public string? LastSyncError { get; set; }
        public string? LastSyncSuccess { get; set; }
    }
}
