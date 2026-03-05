using System.Net.Http.Headers;
using System.Text;
using Kaya.Core.Models;

namespace Kaya.Core.Services;

public class SyncResult
{
    public List<string> Downloaded { get; } = [];
    public List<string> Uploaded { get; } = [];
    public List<SyncError> Errors { get; } = [];
}

public record SyncError(string File, string Operation, string Error);

public class SyncService
{
    private static readonly string LocalAngaDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".kaya", "anga");
    private static readonly string LocalMetaDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".kaya", "meta");
    private static readonly string LocalWordsDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".kaya", "words");

    private readonly SettingsService _settingsService;
    private readonly CredentialService _credentialService;
    private readonly HttpClient _httpClient;
    private bool _isSyncing;

    public bool IsSyncing => _isSyncing;

    public SyncService(SettingsService settingsService, CredentialService credentialService)
    {
        _settingsService = settingsService;
        _credentialService = credentialService;
        _httpClient = new HttpClient();
    }

    public async Task<SyncResult> SyncAsync()
    {
        if (_isSyncing)
            return new SyncResult();

        if (!_settingsService.ShouldSync())
            return new SyncResult();

        var password = _credentialService.GetPassword();
        if (string.IsNullOrEmpty(password))
            return new SyncResult();

        _isSyncing = true;
        var result = new SyncResult();

        try
        {
            var baseUrl = _settingsService.ServerUrl;
            var email = _settingsService.Email;
            var authHeader = CreateAuthHeader(email, password);

            // Sync anga
            var serverFiles = await FetchFileList(baseUrl, email, "anga", authHeader);
            var localFiles = FetchLocalFiles(LocalAngaDir);

            var toDownload = serverFiles.Except(localFiles).ToList();
            var toUpload = localFiles.Except(serverFiles).ToList();

            foreach (var filename in toDownload)
            {
                try
                {
                    await DownloadFile(baseUrl, email, "anga", filename, LocalAngaDir, authHeader);
                    result.Downloaded.Add(filename);
                }
                catch (Exception e)
                {
                    result.Errors.Add(new SyncError(filename, "download", e.Message));
                }
            }

            foreach (var filename in toUpload)
            {
                try
                {
                    if (!new Filename(filename).IsValid())
                    {
                        result.Errors.Add(new SyncError(filename, "upload", "Filename contains URL-illegal characters"));
                        continue;
                    }
                    await UploadFile(baseUrl, email, "anga", filename, LocalAngaDir, authHeader);
                    result.Uploaded.Add(filename);
                }
                catch (Exception e)
                {
                    result.Errors.Add(new SyncError(filename, "upload", e.Message));
                }
            }

            // Sync meta
            await SyncDirectory(baseUrl, email, "meta", LocalMetaDir, authHeader, result, "*.toml");

            // Sync words
            await SyncWords(baseUrl, email, authHeader, result);
        }
        finally
        {
            _isSyncing = false;
        }

        return result;
    }

    private async Task SyncDirectory(string baseUrl, string email, string category,
        string localDir, AuthenticationHeaderValue authHeader, SyncResult result, string? filter = null)
    {
        Directory.CreateDirectory(localDir);

        var serverFiles = await FetchFileList(baseUrl, email, category, authHeader);
        var localFiles = FetchLocalFiles(localDir, filter);

        var toDownload = serverFiles.Except(localFiles).ToList();
        var toUpload = localFiles.Except(serverFiles).ToList();

        foreach (var filename in toDownload)
        {
            try
            {
                await DownloadFile(baseUrl, email, category, filename, localDir, authHeader);
                result.Downloaded.Add(filename);
            }
            catch (Exception e)
            {
                result.Errors.Add(new SyncError(filename, "download", e.Message));
            }
        }

        foreach (var filename in toUpload)
        {
            try
            {
                if (!new Filename(filename).IsValid())
                {
                    result.Errors.Add(new SyncError(filename, "upload", "Filename contains URL-illegal characters"));
                    continue;
                }
                await UploadFile(baseUrl, email, category, filename, localDir, authHeader);
                result.Uploaded.Add(filename);
            }
            catch (Exception e)
            {
                result.Errors.Add(new SyncError(filename, "upload", e.Message));
            }
        }
    }

    private async Task SyncWords(string baseUrl, string email,
        AuthenticationHeaderValue authHeader, SyncResult result)
    {
        Directory.CreateDirectory(LocalWordsDir);

        var serverWords = await FetchFileList(baseUrl, email, "words", authHeader);
        var localWords = FetchLocalDirectories(LocalWordsDir);

        var wordsToDownload = serverWords.Except(localWords).ToList();
        var existingWords = localWords.Intersect(serverWords).ToList();

        // Download new words
        foreach (var word in wordsToDownload)
        {
            await DownloadWord(baseUrl, email, word, authHeader, result);
        }

        // Sync existing words (download missing files)
        foreach (var word in existingWords)
        {
            await SyncExistingWord(baseUrl, email, word, authHeader, result);
        }
    }

    private async Task DownloadWord(string baseUrl, string email, string word,
        AuthenticationHeaderValue authHeader, SyncResult result)
    {
        var wordDir = Path.Combine(LocalWordsDir, word);
        Directory.CreateDirectory(wordDir);

        var serverFiles = await FetchFileList(baseUrl, email, $"words/{Uri.EscapeDataString(word)}", authHeader);
        foreach (var filename in serverFiles)
        {
            try
            {
                await DownloadFile(baseUrl, email, $"words/{Uri.EscapeDataString(word)}", filename, wordDir, authHeader);
                result.Downloaded.Add($"{word}/{filename}");
            }
            catch (Exception e)
            {
                result.Errors.Add(new SyncError($"{word}/{filename}", "download", e.Message));
            }
        }
    }

    private async Task SyncExistingWord(string baseUrl, string email, string word,
        AuthenticationHeaderValue authHeader, SyncResult result)
    {
        var wordDir = Path.Combine(LocalWordsDir, word);
        var serverFiles = await FetchFileList(baseUrl, email, $"words/{Uri.EscapeDataString(word)}", authHeader);
        var localFiles = FetchLocalFiles(wordDir);

        var toDownload = serverFiles.Except(localFiles).ToList();
        foreach (var filename in toDownload)
        {
            try
            {
                await DownloadFile(baseUrl, email, $"words/{Uri.EscapeDataString(word)}", filename, wordDir, authHeader);
                result.Downloaded.Add($"{word}/{filename}");
            }
            catch (Exception e)
            {
                result.Errors.Add(new SyncError($"{word}/{filename}", "download", e.Message));
            }
        }
    }

    private async Task<List<string>> FetchFileList(string baseUrl, string email,
        string category, AuthenticationHeaderValue authHeader)
    {
        var encodedEmail = Uri.EscapeDataString(email);
        var url = $"{baseUrl}/api/v1/{encodedEmail}/{category}";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = authHeader;

        try
        {
            var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return [];

            var content = await response.Content.ReadAsStringAsync();
            return content.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        }
        catch
        {
            return [];
        }
    }

    private async Task DownloadFile(string baseUrl, string email, string category,
        string filename, string localDir, AuthenticationHeaderValue authHeader)
    {
        var encodedEmail = Uri.EscapeDataString(email);
        var encodedFilename = Uri.EscapeDataString(filename);
        var url = $"{baseUrl}/api/v1/{encodedEmail}/{category}/{encodedFilename}";

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = authHeader;

        var response = await _httpClient.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var data = await response.Content.ReadAsByteArrayAsync();
        var localPath = Path.Combine(localDir, filename);
        await File.WriteAllBytesAsync(localPath, data);
    }

    private async Task UploadFile(string baseUrl, string email, string category,
        string filename, string localDir, AuthenticationHeaderValue authHeader)
    {
        var localPath = Path.Combine(localDir, filename);
        var fileBytes = await File.ReadAllBytesAsync(localPath);

        var encodedEmail = Uri.EscapeDataString(email);
        var encodedFilename = Uri.EscapeDataString(filename);
        var url = $"{baseUrl}/api/v1/{encodedEmail}/{category}/{encodedFilename}";

        var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(fileBytes);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(MimeTypeFor(filename));
        content.Add(fileContent, "file", filename);

        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        request.Headers.Authorization = authHeader;

        var response = await _httpClient.SendAsync(request);
        var statusCode = (int)response.StatusCode;
        if (statusCode != 200 && statusCode != 201 && statusCode != 409 && statusCode != 422)
            response.EnsureSuccessStatusCode();
    }

    private static AuthenticationHeaderValue CreateAuthHeader(string email, string password)
    {
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{email}:{password}"));
        return new AuthenticationHeaderValue("Basic", credentials);
    }

    private static List<string> FetchLocalFiles(string directory, string? filter = null)
    {
        if (!Directory.Exists(directory))
            return [];

        var files = Directory.GetFiles(directory)
            .Select(Path.GetFileName)
            .Where(f => f != null && !f.StartsWith('.'))
            .Cast<string>();

        if (filter != null)
        {
            var extension = filter.Replace("*", "");
            files = files.Where(f => f.EndsWith(extension, StringComparison.OrdinalIgnoreCase));
        }

        return files.ToList();
    }

    private static List<string> FetchLocalDirectories(string directory)
    {
        if (!Directory.Exists(directory))
            return [];

        return Directory.GetDirectories(directory)
            .Select(Path.GetFileName)
            .Where(f => f != null && !f.StartsWith('.'))
            .Cast<string>()
            .ToList();
    }

    private static string MimeTypeFor(string filename)
    {
        var ext = Path.GetExtension(filename).ToLowerInvariant().TrimStart('.');
        return ext switch
        {
            "md" => "text/markdown",
            "url" => "text/plain",
            "txt" => "text/plain",
            "json" => "application/json",
            "toml" => "application/toml",
            "pdf" => "application/pdf",
            "png" => "image/png",
            "jpg" or "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            "html" or "htm" => "text/html",
            _ => "application/octet-stream"
        };
    }
}
