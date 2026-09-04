using System.Windows;
using MyTube.ViewModels;

namespace MyTube.Views;

public partial class SettingsWindow : Window
{
    private readonly SettingsViewModel _viewModel;

    public SettingsWindow(SettingsViewModel viewModel)
    {
        InitializeComponent();
        _viewModel = viewModel;
        DataContext = viewModel;
    }

    private void OnSave(object sender, RoutedEventArgs e)
    {
        if (_viewModel.Draft.ClearCookiesOnExit
            && !_viewModel.InitiallyClearedCookiesOnExit)
        {
            var result = MessageBox.Show(
                "Clearing cookies on exit will sign you out of YouTube. Continue?",
                "MyTube",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning,
                MessageBoxResult.No);

            if (result != MessageBoxResult.Yes)
            {
                return;
            }
        }

        DialogResult = true;
    }
}
