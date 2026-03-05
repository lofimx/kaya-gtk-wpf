namespace Kaya.Core.Models;

public record MetaFile(string Filename, string FilenameWithNanos, string Contents);

public class Meta
{
    private readonly string _angaFilename;
    private readonly string _note;
    private readonly IClock _clock;

    public Meta(string angaFilename, string note, IClock clock)
    {
        _angaFilename = angaFilename;
        _note = note;
        _clock = clock;
    }

    public MetaFile ToMetaFile()
    {
        var timestamp = new KayaTimestamp(_clock.Now());
        var sanitizedNote = _note.Replace("'''", "\"\"\"");
        var tomlContent = $"""
            [anga]
            filename = "{_angaFilename}"

            [meta]
            note = '''{sanitizedNote}'''
            """.Replace("            ", "") + "\n";

        return new MetaFile(
            $"{timestamp.Plain}-note.toml",
            $"{timestamp.WithNanos}-note.toml",
            tomlContent
        );
    }
}
