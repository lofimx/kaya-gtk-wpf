namespace Kaya.Core.Models;

public record AngaFile(string Filename, string FilenameWithNanos, string Contents);

public class Anga
{
    private readonly string _text;
    private readonly IClock _clock;

    public Anga(string text, IClock clock)
    {
        _text = text;
        _clock = clock;
    }

    public AngaFile ToAngaFile()
    {
        var timestamp = new KayaTimestamp(_clock.Now());

        if (_text.StartsWith("http://") || _text.StartsWith("https://"))
        {
            return new AngaFile(
                $"{timestamp.Plain}-bookmark.url",
                $"{timestamp.WithNanos}-bookmark.url",
                $"[InternetShortcut]\nURL={_text}\n"
            );
        }

        return new AngaFile(
            $"{timestamp.Plain}-note.md",
            $"{timestamp.WithNanos}-note.md",
            _text
        );
    }
}
