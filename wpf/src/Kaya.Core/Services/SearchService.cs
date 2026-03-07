using Kaya.Core.Models;

namespace Kaya.Core.Services;

public class SearchService
{
    private static readonly string AngaDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".kaya", "anga");

    private static readonly HashSet<string> TextExtensions =
        ["md", "url", "txt", "toml", "json", "html"];

    private List<SearchResult>? _cache;

    public List<SearchResult> LoadAllFiles()
    {
        if (_cache is not null)
            return _cache;

        var filenames = ListAngaFiles();
        var results = new List<SearchResult>();

        foreach (var filename in filenames)
        {
            var contents = ReadFileContents(filename);
            results.Add(SearchResultFactory.FromFile(filename, contents));
        }

        results.Sort((a, b) => string.Compare(b.RawTimestamp, a.RawTimestamp, StringComparison.Ordinal));

        _cache = results;
        Console.WriteLine($"🔵 INFO SearchService loaded {results.Count} anga files");
        return results;
    }

    public List<SearchResult> Search(string query)
    {
        var allFiles = LoadAllFiles();
        if (string.IsNullOrWhiteSpace(query))
            return allFiles;

        return allFiles.Where(r => SearchResultFactory.MatchesQuery(r, query)).ToList();
    }

    public void InvalidateCache()
    {
        _cache = null;
        Console.WriteLine("🟢 DEBUG SearchService cache invalidated");
    }

    private static List<string> ListAngaFiles()
    {
        if (!Directory.Exists(AngaDir))
            return [];

        return Directory.GetFiles(AngaDir)
            .Select(Path.GetFileName)
            .Where(name => name is not null && !name.StartsWith('.'))
            .Cast<string>()
            .ToList();
    }

    private static string ReadFileContents(string filename)
    {
        var ext = filename.Split('.').LastOrDefault()?.ToLowerInvariant() ?? "";
        if (!TextExtensions.Contains(ext))
            return "";

        try
        {
            var filePath = Path.Combine(AngaDir, filename);
            return File.ReadAllText(filePath);
        }
        catch (Exception e)
        {
            Console.Error.WriteLine($"🔴 ERROR SearchService failed to read {filename}: {e.Message}");
            return "";
        }
    }
}
