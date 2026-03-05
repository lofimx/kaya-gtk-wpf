namespace Kaya.Core.Models;

public record DroppedFileRecord(string Filename, string FilenameWithNanos, byte[] Contents);

public class DroppedFile
{
    private readonly string _originalFilename;
    private readonly byte[] _contents;
    private readonly IClock _clock;

    public DroppedFile(string originalFilename, byte[] contents, IClock clock)
    {
        _originalFilename = originalFilename;
        _contents = contents;
        _clock = clock;
    }

    public DroppedFileRecord ToDroppedFile()
    {
        var timestamp = new KayaTimestamp(_clock.Now());
        var encodedFilename = Uri.EscapeDataString(_originalFilename);

        return new DroppedFileRecord(
            $"{timestamp.Plain}-{encodedFilename}",
            $"{timestamp.WithNanos}-{encodedFilename}",
            _contents
        );
    }
}
