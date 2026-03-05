using System.Text;
using Kaya.Core.Models;

namespace Kaya.Tests;

public class DroppedFileTests
{
    private static readonly DateTimeOffset TestTime =
        new(2005, 8, 9, 12, 34, 56, TimeSpan.Zero);

    private static readonly FrozenClock Clock = new(TestTime);

    [Fact]
    public void Should_create_timestamped_filename_from_original_filename()
    {
        var contents = Encoding.UTF8.GetBytes("file contents");
        var dropped = new DroppedFile("document.pdf", contents, Clock);
        var result = dropped.ToDroppedFile();

        Assert.Equal("2005-08-09T123456-document.pdf", result.Filename);
        Assert.Equal("2005-08-09T123456_000000000-document.pdf", result.FilenameWithNanos);
        Assert.Equal(contents, result.Contents);
    }

    [Fact]
    public void Should_preserve_original_file_extension()
    {
        var contents = Encoding.UTF8.GetBytes("image data");
        var dropped = new DroppedFile("photo.jpg", contents, Clock);

        Assert.Equal("2005-08-09T123456-photo.jpg", dropped.ToDroppedFile().Filename);
    }

    [Fact]
    public void Should_handle_filenames_with_multiple_dots()
    {
        var contents = Encoding.UTF8.GetBytes("archive");
        var dropped = new DroppedFile("backup.tar.gz", contents, Clock);

        Assert.Equal("2005-08-09T123456-backup.tar.gz", dropped.ToDroppedFile().Filename);
    }

    [Fact]
    public void Should_preserve_binary_contents()
    {
        var binaryContents = new byte[] { 0x00, 0xFF, 0x42, 0x89 };
        var dropped = new DroppedFile("binary.bin", binaryContents, Clock);

        Assert.Equal(binaryContents, dropped.ToDroppedFile().Contents);
    }

    [Fact]
    public void Should_URI_encode_filenames_with_spaces()
    {
        var contents = Encoding.UTF8.GetBytes("screenshot");
        var dropped = new DroppedFile("GNOME Desktop.png", contents, Clock);
        var result = dropped.ToDroppedFile();

        Assert.Equal("2005-08-09T123456-GNOME%20Desktop.png", result.Filename);
        Assert.Equal("2005-08-09T123456_000000000-GNOME%20Desktop.png", result.FilenameWithNanos);
    }

    [Fact]
    public void Should_URI_encode_filenames_with_special_characters()
    {
        var contents = Encoding.UTF8.GetBytes("data");
        var dropped = new DroppedFile("file (1) & copy.txt", contents, Clock);

        Assert.Equal("2005-08-09T123456-file%20%281%29%20%26%20copy.txt", dropped.ToDroppedFile().Filename);
    }
}
