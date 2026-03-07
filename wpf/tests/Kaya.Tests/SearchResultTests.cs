using Kaya.Core.Models;

namespace Kaya.Tests;

public class SearchResultTests
{
    public class DetermineTypeTests
    {
        [Fact]
        public void Should_identify_url_files_as_bookmarks()
        {
            Assert.Equal(AngaType.Bookmark,
                SearchResultFactory.DetermineType("2025-06-28T120000-bookmark.url"));
        }

        [Fact]
        public void Should_identify_md_files_as_notes()
        {
            Assert.Equal(AngaType.Note,
                SearchResultFactory.DetermineType("2025-06-28T120000-note.md"));
        }

        [Fact]
        public void Should_identify_other_extensions_as_files()
        {
            Assert.Equal(AngaType.File,
                SearchResultFactory.DetermineType("2025-06-28T120000-photo.png"));
        }
    }

    public class ExtractDisplayTitleTests
    {
        [Fact]
        public void Should_strip_timestamp_and_extension_replacing_hyphens_with_spaces()
        {
            Assert.Equal("my important note",
                SearchResultFactory.ExtractDisplayTitle("2025-06-28T120000-my-important-note.md"));
        }

        [Fact]
        public void Should_handle_nanosecond_timestamps()
        {
            Assert.Equal("note",
                SearchResultFactory.ExtractDisplayTitle("2026-01-21T164145_354000000-note.md"));
        }

        [Fact]
        public void Should_handle_filenames_with_multiple_dots()
        {
            Assert.Equal("my file.tar",
                SearchResultFactory.ExtractDisplayTitle("2025-06-28T120000-my-file.tar.gz"));
        }
    }

    public class ExtractDateTests
    {
        [Fact]
        public void Should_extract_date_from_filename_timestamp()
        {
            Assert.Equal("2025-06-28",
                SearchResultFactory.ExtractDate("2025-06-28T120000-note.md"));
        }

        [Fact]
        public void Should_extract_date_from_nanosecond_timestamp()
        {
            Assert.Equal("2026-01-21",
                SearchResultFactory.ExtractDate("2026-01-21T164145_354000000-note.md"));
        }
    }

    public class FromFileTests
    {
        [Fact]
        public void Should_create_a_bookmark_with_domain_preview()
        {
            var result = SearchResultFactory.FromFile(
                "2025-06-28T120000-bookmark.url",
                "[InternetShortcut]\nURL=https://example.com/path\n");

            Assert.Equal(AngaType.Bookmark, result.Type);
            Assert.Equal("example.com", result.ContentPreview);
            Assert.Equal("bookmark", result.DisplayTitle);
            Assert.Equal("2025-06-28", result.Date);
        }

        [Fact]
        public void Should_create_a_note_with_text_preview()
        {
            var result = SearchResultFactory.FromFile(
                "2025-06-28T120000-note.md",
                "Hello world, this is my note");

            Assert.Equal(AngaType.Note, result.Type);
            Assert.Equal("Hello world, this is my note", result.ContentPreview);
            Assert.Equal("note", result.DisplayTitle);
        }

        [Fact]
        public void Should_truncate_long_note_previews()
        {
            var longText = new string('a', 150);
            var result = SearchResultFactory.FromFile(
                "2025-06-28T120000-note.md", longText);

            Assert.Equal(new string('a', 100) + "...", result.ContentPreview);
        }

        [Fact]
        public void Should_create_a_file_with_empty_preview()
        {
            var result = SearchResultFactory.FromFile(
                "2025-06-28T120000-photo.png", "");

            Assert.Equal(AngaType.File, result.Type);
            Assert.Equal("", result.ContentPreview);
        }
    }

    public class MatchesQueryTests
    {
        private readonly SearchResult _result = SearchResultFactory.FromFile(
            "2025-06-28T120000-bookmark.url",
            "[InternetShortcut]\nURL=https://example.com\n");

        [Fact]
        public void Should_match_on_filename()
        {
            Assert.True(SearchResultFactory.MatchesQuery(_result, "bookmark"));
        }

        [Fact]
        public void Should_match_on_display_title()
        {
            Assert.True(SearchResultFactory.MatchesQuery(_result, "bookmark"));
        }

        [Fact]
        public void Should_match_on_content_preview()
        {
            Assert.True(SearchResultFactory.MatchesQuery(_result, "example.com"));
        }

        [Fact]
        public void Should_be_case_insensitive()
        {
            Assert.True(SearchResultFactory.MatchesQuery(_result, "EXAMPLE"));
        }

        [Fact]
        public void Should_return_false_for_non_matching_query()
        {
            Assert.False(SearchResultFactory.MatchesQuery(_result, "zzzzz"));
        }
    }
}
