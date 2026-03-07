using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Kaya.Core.Models;
using Kaya.Core.Services;
using Microsoft.Win32;

namespace Kaya.Wpf;

public partial class NewSaveWindow : Window
{
    private readonly FileService _fileService = new();
    private readonly IClock _clock = new SystemClock();
    private readonly List<string> _tags = [];
    private DispatcherTimer? _toastTimer;

    private string? _droppedFileName;
    private byte[]? _droppedFileContents;

    public Action? OnSaveComplete { get; set; }

    public NewSaveWindow()
    {
        InitializeComponent();
        this.ApplyDarkTitleBar();
        _fileService.EnsureKayaDirectories();

        Loaded += (_, _) => AngaText.Focus();
        Console.WriteLine("🔵 INFO NewSaveWindow initialized");
    }

    private void OnWindowKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            Close();
            e.Handled = true;
        }
    }

    private void OnTagsPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.OemComma)
        {
            FinalizeTagEntry();
            e.Handled = true;
        }
        else if (e.Key == Key.Back && TagsEntry.Text.Length == 0 && _tags.Count > 0)
        {
            RemoveLastTag();
            e.Handled = true;
        }
        else if (e.Key == Key.Tab && TagsEntry.Text.Trim().Length > 0)
        {
            FinalizeTagEntry();
            e.Handled = true;
        }
    }

    private void OnTagsKeyDown(object sender, KeyEventArgs e)
    {
        // Additional key handling if needed
    }

    private void FinalizeTagEntry()
    {
        var text = TagsEntry.Text.Trim();
        if (text.Length > 0)
        {
            AddTagPill(text);
            TagsEntry.Text = "";
        }
    }

    private void AddTagPill(string tagText)
    {
        _tags.Add(tagText);

        var pill = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(0x00, 0x78, 0xD4)),
            CornerRadius = new CornerRadius(12),
            Padding = new Thickness(10, 4, 10, 4),
            Margin = new Thickness(2),
            Child = new TextBlock
            {
                Text = tagText,
                Foreground = Brushes.White,
                FontSize = 12,
                VerticalAlignment = VerticalAlignment.Center
            }
        };

        // Insert pill before the TextBox entry
        var entryIndex = TagsPanel.Children.IndexOf(TagsEntry);
        TagsPanel.Children.Insert(entryIndex, pill);
        Console.WriteLine($"🟢 DEBUG Tag added: \"{tagText}\"");
    }

    private void RemoveLastTag()
    {
        if (_tags.Count == 0) return;

        var removed = _tags[^1];
        _tags.RemoveAt(_tags.Count - 1);

        // Remove the last pill (the one before TagsEntry)
        var entryIndex = TagsPanel.Children.IndexOf(TagsEntry);
        if (entryIndex > 0)
        {
            TagsPanel.Children.RemoveAt(entryIndex - 1);
        }
        Console.WriteLine($"🟢 DEBUG Tag removed: \"{removed}\"");
    }

    private void OnWindowDragEnter(object sender, DragEventArgs e)
    {
        if (e.Data.GetDataPresent(DataFormats.FileDrop))
        {
            e.Effects = DragDropEffects.Copy;
            BorderBrush = new SolidColorBrush(Colors.DodgerBlue);
            BorderThickness = new Thickness(2);
        }
        else
        {
            e.Effects = DragDropEffects.None;
        }
        e.Handled = true;
    }

    private void OnWindowDragLeave(object sender, DragEventArgs e)
    {
        BorderBrush = null;
        BorderThickness = new Thickness(0);
    }

    private void OnWindowDrop(object sender, DragEventArgs e)
    {
        BorderBrush = null;
        BorderThickness = new Thickness(0);

        if (!e.Data.GetDataPresent(DataFormats.FileDrop)) return;

        var files = (string[])e.Data.GetData(DataFormats.FileDrop)!;
        if (files.Length > 0)
        {
            HandleDroppedFile(files[0]);
        }
    }

    private void OnOpenFile(object sender, RoutedEventArgs e)
    {
        var dialog = new OpenFileDialog
        {
            Title = "Select a file to save",
            Filter = "All files (*.*)|*.*"
        };

        if (dialog.ShowDialog(this) == true)
        {
            HandleDroppedFile(dialog.FileName);
        }
    }

    private void HandleDroppedFile(string filePath)
    {
        try
        {
            _droppedFileName = Path.GetFileName(filePath);
            _droppedFileContents = File.ReadAllBytes(filePath);
            ShowFilePreview(_droppedFileName, filePath);
            Console.WriteLine($"🔵 INFO File selected: \"{_droppedFileName}\"");
        }
        catch (Exception ex)
        {
            ShowToast($"Failed to read file: {ex.Message}", isError: true);
            Console.Error.WriteLine($"🔴 ERROR Failed to read file: {ex.Message}");
        }
    }

    private void ShowFilePreview(string filename, string filePath)
    {
        FilePreviewName.Text = filename;

        // Try to show image preview
        var ext = Path.GetExtension(filename).ToLowerInvariant();
        var imageExtensions = new HashSet<string> { ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp" };

        if (imageExtensions.Contains(ext))
        {
            try
            {
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.UriSource = new Uri(filePath);
                bitmap.DecodePixelWidth = 256;
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.EndInit();

                FilePreviewIcon.Visibility = Visibility.Collapsed;

                // Check if there's already an Image control, remove it
                var existingImage = FilePreviewContent.Children.OfType<Image>().FirstOrDefault();
                if (existingImage != null)
                    FilePreviewContent.Children.Remove(existingImage);

                var image = new Image
                {
                    Source = bitmap,
                    MaxWidth = 256,
                    MaxHeight = 256,
                    Stretch = Stretch.Uniform,
                    Margin = new Thickness(0, 0, 0, 10)
                };
                FilePreviewContent.Children.Insert(0, image);
            }
            catch
            {
                FilePreviewIcon.Visibility = Visibility.Visible;
                FilePreviewIcon.Text = "\U0001F5BC"; // framed picture emoji
            }
        }
        else
        {
            FilePreviewIcon.Visibility = Visibility.Visible;
            FilePreviewIcon.Text = "\U0001F4C4"; // page facing up emoji
        }

        FormPanel.Visibility = Visibility.Collapsed;
        FilePreviewPanel.Visibility = Visibility.Visible;
    }

    private void OnRemoveFile(object sender, RoutedEventArgs e)
    {
        _droppedFileName = null;
        _droppedFileContents = null;

        // Remove any image preview
        var existingImage = FilePreviewContent.Children.OfType<Image>().FirstOrDefault();
        if (existingImage != null)
            FilePreviewContent.Children.Remove(existingImage);
        FilePreviewIcon.Visibility = Visibility.Visible;

        FilePreviewPanel.Visibility = Visibility.Collapsed;
        FormPanel.Visibility = Visibility.Visible;
        Console.WriteLine("🔵 INFO File removed from New Save");
    }

    private void OnCancel(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void OnSave(object sender, RoutedEventArgs e)
    {
        Console.WriteLine("🔵 INFO NewSaveWindow on_save fired");

        try
        {
            string angaFilename;

            if (_droppedFileContents is not null && _droppedFileName is not null)
            {
                var dropped = new DroppedFile(_droppedFileName, _droppedFileContents, _clock);
                var droppedFile = dropped.ToDroppedFile();
                _fileService.SaveDroppedFile(droppedFile);
                angaFilename = droppedFile.Filename;
            }
            else
            {
                var text = AngaText.Text.Trim();
                if (string.IsNullOrEmpty(text))
                {
                    ShowToast("Nothing to save", isError: true);
                    return;
                }

                var anga = new Anga(text, _clock);
                var angaFile = anga.ToAngaFile();
                _fileService.Save(angaFile);
                angaFilename = angaFile.Filename;
            }

            var noteText = NoteText.Text.Trim();

            // Finalize any pending tag text
            var pendingTag = TagsEntry.Text.Trim();
            if (pendingTag.Length > 0)
            {
                _tags.Add(pendingTag);
            }

            // Save metadata if there's a note or tags
            if (noteText.Length > 0 || _tags.Count > 0)
            {
                var meta = new Meta(angaFilename, noteText, _tags.ToArray(), _clock);
                _fileService.SaveMeta(meta.ToMetaFile());
            }

            OnSaveComplete?.Invoke();
            Close();
        }
        catch (Exception ex)
        {
            ShowToast($"Error: {ex.Message}", isError: true);
            Console.Error.WriteLine($"🔴 ERROR Failed to save: {ex.Message}");
        }
    }

    private void ShowToast(string message, bool isError = false)
    {
        ToastText.Text = message;
        ToastBorder.Background = new SolidColorBrush(isError
            ? Color.FromRgb(0xF4, 0x43, 0x36)
            : Color.FromRgb(0x4C, 0xAF, 0x50));
        ToastBorder.Visibility = Visibility.Visible;

        _toastTimer?.Stop();
        _toastTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(3) };
        _toastTimer.Tick += (_, _) =>
        {
            ToastBorder.Visibility = Visibility.Collapsed;
            _toastTimer.Stop();
        };
        _toastTimer.Start();
    }
}
