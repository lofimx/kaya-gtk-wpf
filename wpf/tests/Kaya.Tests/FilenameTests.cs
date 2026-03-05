using Kaya.Core.Models;

namespace Kaya.Tests;

public class FilenameTests
{
    [Theory]
    [InlineData("document.pdf")]
    [InlineData("photo.jpg")]
    [InlineData("file.txt")]
    [InlineData("archive.tar.gz")]
    [InlineData("data.json")]
    [InlineData("image.png")]
    public void Should_return_true_for_simple_valid_filenames(string filename)
    {
        Assert.True(new Filename(filename).IsValid());
    }

    [Theory]
    [InlineData("file-123.txt")]
    [InlineData("File_With_Underscores.txt")]
    [InlineData("Name.With.Dots.doc")]
    [InlineData("UPPERCASE.TXT")]
    [InlineData("lowercase.md")]
    [InlineData("MixedCase-File_Name.md")]
    [InlineData("test123-456_789.txt")]
    public void Should_return_true_for_filenames_with_URL_safe_characters(string filename)
    {
        Assert.True(new Filename(filename).IsValid());
    }

    [Theory]
    [InlineData("this%20file%20had%20spaces.pdf")]
    [InlineData("file%281%29.txt")]
    [InlineData("document%20%26%20copy.pdf")]
    [InlineData("file%23123.pdf")]
    [InlineData("image%3Fquestion.png")]
    [InlineData("file%5B1%5D.txt")]
    [InlineData("name%40email.com.pdf")]
    [InlineData("file%7Bdata%7D.json")]
    public void Should_return_true_for_filenames_that_are_already_URL_encoded(string filename)
    {
        Assert.True(new Filename(filename).IsValid());
    }

    [Fact]
    public void Should_return_false_for_filenames_with_spaces()
    {
        Assert.False(new Filename("file with spaces.pdf").IsValid());
    }

    [Fact]
    public void Should_return_false_for_filenames_with_parentheses()
    {
        Assert.False(new Filename("file(1).txt").IsValid());
    }

    [Fact]
    public void Should_return_false_for_filenames_with_ampersands()
    {
        Assert.False(new Filename("file & copy.txt").IsValid());
    }

    [Fact]
    public void Should_return_false_for_filenames_with_hash()
    {
        Assert.False(new Filename("file#123.pdf").IsValid());
    }

    [Fact]
    public void Should_return_false_for_filenames_with_question_marks()
    {
        Assert.False(new Filename("file?.txt").IsValid());
    }

    [Theory]
    [InlineData("file[1].txt")]
    [InlineData("file{name}.json")]
    [InlineData("file@email.com.pdf")]
    [InlineData("file+plus.txt")]
    [InlineData("file=equal.doc")]
    [InlineData("file!exclam.pdf")]
    [InlineData("file*star.txt")]
    [InlineData("file'tick.doc")]
    [InlineData("file\"quote.pdf")]
    [InlineData("file<angle>.txt")]
    public void Should_return_false_for_filenames_with_other_special_characters(string filename)
    {
        Assert.False(new Filename(filename).IsValid());
    }

    [Fact]
    public void Should_handle_empty_string()
    {
        Assert.True(new Filename("").IsValid());
    }

    [Fact]
    public void Should_preserve_the_original_filename_value()
    {
        var fn = new Filename("test file.txt");
        Assert.Equal("test file.txt", fn.Value);
    }
}
