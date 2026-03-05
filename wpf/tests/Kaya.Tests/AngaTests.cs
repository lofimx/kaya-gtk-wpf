using Kaya.Core.Models;

namespace Kaya.Tests;

public class AngaTests
{
    private static readonly DateTimeOffset TestTime =
        new(2005, 8, 9, 12, 34, 56, TimeSpan.Zero);

    private static readonly FrozenClock Clock = new(TestTime);

    [Fact]
    public void Should_save_http_stuff_with_a_trailing_newline()
    {
        var result = new Anga("https://deobald.ca", Clock).ToAngaFile();

        Assert.Equal("2005-08-09T123456-bookmark.url", result.Filename);
        Assert.Equal("2005-08-09T123456_000000000-bookmark.url", result.FilenameWithNanos);
        Assert.Equal("[InternetShortcut]\nURL=https://deobald.ca\n", result.Contents);
    }

    [Fact]
    public void Should_save_non_http_as_text_notes()
    {
        var result = new Anga("42", Clock).ToAngaFile();

        Assert.Equal("2005-08-09T123456-note.md", result.Filename);
        Assert.Equal("2005-08-09T123456_000000000-note.md", result.FilenameWithNanos);
        Assert.Equal("42", result.Contents);
    }
}
