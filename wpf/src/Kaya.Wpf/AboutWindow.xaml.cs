using System.Windows;

namespace Kaya.Wpf;

public partial class AboutWindow : Window
{
    public AboutWindow()
    {
        InitializeComponent();
        this.ApplyDarkTitleBar();
    }

    private void OnOK(object sender, RoutedEventArgs e) => Close();
}
