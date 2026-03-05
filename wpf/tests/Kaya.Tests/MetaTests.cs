using Kaya.Core.Models;

namespace Kaya.Tests;

public class MetaTests
{
    private static readonly DateTimeOffset TestTime =
        new(2005, 8, 9, 12, 34, 56, TimeSpan.Zero);

    private static readonly FrozenClock Clock = new(TestTime);

    [Fact]
    public void Should_create_a_TOML_file_with_correct_format()
    {
        var meta = new Meta("2005-08-09T123456-bookmark.url", "This is my note", Clock);
        var result = meta.ToMetaFile();

        Assert.Equal("2005-08-09T123456-note.toml", result.Filename);
        Assert.Equal("2005-08-09T123456_000000000-note.toml", result.FilenameWithNanos);
        Assert.Equal(
            "[anga]\nfilename = \"2005-08-09T123456-bookmark.url\"\n\n[meta]\nnote = '''This is my note'''\n",
            result.Contents);
    }

    [Fact]
    public void Should_handle_multi_line_notes()
    {
        var meta = new Meta("2005-08-09T123456-bookmark.url", "Line 1\nLine 2\nLine 3", Clock);
        var result = meta.ToMetaFile();

        Assert.Equal(
            "[anga]\nfilename = \"2005-08-09T123456-bookmark.url\"\n\n[meta]\nnote = '''Line 1\nLine 2\nLine 3'''\n",
            result.Contents);
    }

    [Fact]
    public void Should_replace_triple_single_quotes_with_triple_double_quotes()
    {
        var meta = new Meta("2005-08-09T123456-bookmark.url", "This note contains ''' triple quotes", Clock);
        var result = meta.ToMetaFile();

        Assert.Equal(
            "[anga]\nfilename = \"2005-08-09T123456-bookmark.url\"\n\n[meta]\nnote = '''This note contains \"\"\" triple quotes'''\n",
            result.Contents);
    }

    [Fact]
    public void Should_handle_multiple_occurrences_of_triple_single_quotes()
    {
        var meta = new Meta("2005-08-09T123456-bookmark.url", "First ''' and second ''' occurrences", Clock);
        var result = meta.ToMetaFile();

        Assert.Equal(
            "[anga]\nfilename = \"2005-08-09T123456-bookmark.url\"\n\n[meta]\nnote = '''First \"\"\" and second \"\"\" occurrences'''\n",
            result.Contents);
    }

    [Fact]
    public void Should_handle_notes_that_are_only_triple_single_quotes()
    {
        var meta = new Meta("2005-08-09T123456-bookmark.url", "'''", Clock);
        var result = meta.ToMetaFile();

        Assert.Equal(
            "[anga]\nfilename = \"2005-08-09T123456-bookmark.url\"\n\n[meta]\nnote = '''\"\"\"'''\n",
            result.Contents);
    }

    [Fact]
    public void Should_preserve_single_and_double_quotes_that_are_not_triple()
    {
        var meta = new Meta("2005-08-09T123456-bookmark.url", "It's a \"quoted\" string with '' two singles", Clock);
        var result = meta.ToMetaFile();

        Assert.Equal(
            "[anga]\nfilename = \"2005-08-09T123456-bookmark.url\"\n\n[meta]\nnote = '''It's a \"quoted\" string with '' two singles'''\n",
            result.Contents);
    }
}
