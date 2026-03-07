using System.Text.RegularExpressions;

namespace Kaya.Core.Models;

public enum AngaType
{
    Bookmark,
    Note,
    File
}

public record SearchResult(
    string Filename,
    AngaType Type,
    string DisplayTitle,
    string ContentPreview,
    string Date,
    string RawTimestamp
);

public static partial class SearchResultFactory
{
    private static readonly Regex TimestampPrefixRegex = GenerateTimestampPrefixRegex();
    private static readonly Regex TimestampExtractRegex = GenerateTimestampExtractRegex();
    private static readonly Regex RawTimestampRegex = GenerateRawTimestampRegex();

    [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}T\d{6}(?:_\d{9})?-")]
    private static partial Regex GenerateTimestampPrefixRegex();

    [GeneratedRegex(@"^(\d{4}-\d{2}-\d{2})T(\d{6})")]
    private static partial Regex GenerateTimestampExtractRegex();

    [GeneratedRegex(@"^(\d{4}-\d{2}-\d{2}T\d{6}(?:_\d{9})?)")]
    private static partial Regex GenerateRawTimestampRegex();

    public static SearchResult FromFile(string filename, string contents)
    {
        var type = DetermineType(filename);
        return new SearchResult(
            filename,
            type,
            ExtractDisplayTitle(filename),
            ExtractContentPreview(type, contents),
            ExtractDate(filename),
            ExtractRawTimestamp(filename)
        );
    }

    public static AngaType DetermineType(string filename)
    {
        var ext = filename.Split('.').LastOrDefault()?.ToLowerInvariant() ?? "";
        return ext switch
        {
            "url" => AngaType.Bookmark,
            "md" => AngaType.Note,
            _ => AngaType.File
        };
    }

    public static string ExtractDisplayTitle(string filename)
    {
        var withoutTimestamp = TimestampPrefixRegex.Replace(filename, "");
        var lastDot = withoutTimestamp.LastIndexOf('.');
        var withoutExtension = lastDot > 0 ? withoutTimestamp[..lastDot] : withoutTimestamp;
        return withoutExtension.Replace('-', ' ');
    }

    public static string ExtractContentPreview(AngaType type, string contents)
    {
        if (type == AngaType.Bookmark)
            return ExtractDomainFromUrl(contents);

        if (type == AngaType.Note)
        {
            const int maxPreviewLength = 100;
            return contents.Length > maxPreviewLength
                ? contents[..maxPreviewLength] + "..."
                : contents;
        }

        return "";
    }

    public static string ExtractDate(string filename)
    {
        var match = TimestampExtractRegex.Match(filename);
        return match.Success ? match.Groups[1].Value : "";
    }

    public static string ExtractRawTimestamp(string filename)
    {
        var match = RawTimestampRegex.Match(filename);
        return match.Success ? match.Groups[1].Value : "";
    }

    public static bool MatchesQuery(SearchResult result, string query)
    {
        var q = query.ToLowerInvariant();
        return result.Filename.ToLowerInvariant().Contains(q) ||
               result.DisplayTitle.ToLowerInvariant().Contains(q) ||
               result.ContentPreview.ToLowerInvariant().Contains(q);
    }

    private static string ExtractDomainFromUrl(string contents)
    {
        var lines = contents.Split('\n');
        foreach (var line in lines)
        {
            if (line.StartsWith("URL="))
            {
                var urlString = line[4..].Trim();
                if (Uri.TryCreate(urlString, UriKind.Absolute, out var uri))
                    return uri.Host;
                return urlString;
            }
        }
        return "";
    }
}
