using System.IO;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using Kaya.Core.Models;
using Kaya.Core.Services;

namespace Kaya.Wpf;

public partial class MainWindow : Window
{
    private readonly FileService _fileService = new();
    private readonly IClock _clock = new SystemClock();
    private DispatcherTimer? _toastTimer;

    public MainWindow()
    {
        InitializeComponent();
        this.ApplyDarkTitleBar();
        _fileService.EnsureKayaDirectories();

        // Keyboard shortcuts
        InputBindings.Add(new KeyBinding(ApplicationCommands.Close, Key.Q, ModifierKeys.Control));
        InputBindings.Add(new KeyBinding(new RelayCommand(_ => OnPreferences(this, new RoutedEventArgs())),
            Key.OemComma, ModifierKeys.Control));
        InputBindings.Add(new KeyBinding(new RelayCommand(_ => Close()),
            Key.W, ModifierKeys.Control));
    }

    private void OnSave(object sender, RoutedEventArgs e)
    {
        var text = AngaText.Text.Trim();
        if (string.IsNullOrEmpty(text))
        {
            ShowToast("Nothing to save", isError: true);
            return;
        }

        try
        {
            var anga = new Anga(text, _clock);
            var angaFile = anga.ToAngaFile();
            _fileService.Save(angaFile);

            var noteText = NoteText.Text.Trim();
            if (!string.IsNullOrEmpty(noteText))
            {
                var meta = new Meta(angaFile.Filename, noteText, _clock);
                _fileService.SaveMeta(meta.ToMetaFile());
            }

            AngaText.Text = "";
            NoteText.Text = "";
            ShowToast("Saved!");
        }
        catch (Exception ex)
        {
            ShowToast($"Error: {ex.Message}", isError: true);
        }
    }

    private void OnDragEnter(object sender, DragEventArgs e)
    {
        if (e.Data.GetDataPresent(DataFormats.FileDrop))
        {
            DropTargetBorder.BorderBrush = new SolidColorBrush(Colors.DodgerBlue);
            e.Effects = DragDropEffects.Copy;
        }
        else
        {
            e.Effects = DragDropEffects.None;
        }
        e.Handled = true;
    }

    private void OnDragLeave(object sender, DragEventArgs e)
    {
        DropTargetBorder.BorderBrush = new SolidColorBrush(Colors.Gray);
    }

    private void OnDrop(object sender, DragEventArgs e)
    {
        DropTargetBorder.BorderBrush = new SolidColorBrush(Colors.Gray);

        if (!e.Data.GetDataPresent(DataFormats.FileDrop)) return;

        var files = (string[])e.Data.GetData(DataFormats.FileDrop)!;
        var savedCount = 0;

        foreach (var filePath in files)
        {
            try
            {
                var fileName = Path.GetFileName(filePath);
                var contents = File.ReadAllBytes(filePath);
                var dropped = new DroppedFile(fileName, contents, _clock);
                _fileService.SaveDroppedFile(dropped.ToDroppedFile());
                savedCount++;
            }
            catch (Exception ex)
            {
                ShowToast($"Failed to save {Path.GetFileName(filePath)}: {ex.Message}", isError: true);
            }
        }

        if (savedCount > 0)
            ShowToast($"Saved {savedCount} file(s)!");
    }

    private void OnPreferences(object sender, RoutedEventArgs e)
    {
        var prefs = new PreferencesWindow { Owner = this };
        prefs.ShowDialog();
    }

    private void OnAbout(object sender, RoutedEventArgs e)
    {
        var about = new AboutWindow { Owner = this };
        about.ShowDialog();
    }

    private void OnQuit(object sender, RoutedEventArgs e)
    {
        Application.Current.Shutdown();
    }

    private void OnClose(object sender, ExecutedRoutedEventArgs e)
    {
        Close();
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

public class RelayCommand : ICommand
{
    private readonly Action<object?> _execute;

    public RelayCommand(Action<object?> execute) => _execute = execute;

    public event EventHandler? CanExecuteChanged
    {
        add => CommandManager.RequerySuggested += value;
        remove => CommandManager.RequerySuggested -= value;
    }
    public bool CanExecute(object? parameter) => true;
    public void Execute(object? parameter) => _execute(parameter);
}
