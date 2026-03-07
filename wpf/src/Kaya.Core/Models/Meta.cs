namespace Kaya.Core.Models;

public record MetaFile(string Filename, string FilenameWithNanos, string Contents);

public class Meta
{
    private readonly string _angaFilename;
    private readonly string _note;
    private readonly string[] _tags;
    private readonly IClock _clock;

    public Meta(string angaFilename, string note, IClock clock)
        : this(angaFilename, note, [], clock)
    {
    }

    public Meta(string angaFilename, string note, string[] tags, IClock clock)
    {
        _angaFilename = angaFilename;
        _note = note;
        _tags = tags;
        _clock = clock;
    }

    public MetaFile ToMetaFile()
    {
        var timestamp = new KayaTimestamp(_clock.Now());
        var suffix = FilenameSuffix();

        var metaLines = new List<string>();
        if (_tags.Length > 0)
        {
            var tagsArray = string.Join(", ", _tags.Select(t => $"\"{t}\""));
            metaLines.Add($"tags = [{tagsArray}]");
        }
        if (_note.Length > 0)
        {
            var sanitizedNote = _note.Replace("'''", "\"\"\"");
            metaLines.Add($"note = '''{sanitizedNote}'''");
        }

        var tomlContent = $"[anga]\nfilename = \"{_angaFilename}\"\n\n[meta]\n{string.Join("\n", metaLines)}\n";

        return new MetaFile(
            $"{timestamp.Plain}-{suffix}.toml",
            $"{timestamp.WithNanos}-{suffix}.toml",
            tomlContent
        );
    }

    private string FilenameSuffix()
    {
        var hasNote = _note.Length > 0;
        var hasTags = _tags.Length > 0;
        if (hasNote && hasTags) return "meta";
        if (hasTags) return "tags";
        return "note";
    }
}
