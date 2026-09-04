using System.Windows;

namespace MyTube.Views;

public partial class ExternalLinkDialog : Window
{
    public ExternalLinkDialog(Uri uri)
    {
        InitializeComponent();
        UrlTextBox.Text = uri.AbsoluteUri;
    }

    private void OnOpenInBrowser(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
    }
}
