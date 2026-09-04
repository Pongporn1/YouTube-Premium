using System.Windows;
using MyTube.Services;
using MyTube.ViewModels;
using MyTube.Views;

namespace MyTube;

public partial class App : Application
{
    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var profileService = new ProfileService();
        var loggingService = new LoggingService(profileService.LogDirectory);
        loggingService.Info("Application starting.");

        try
        {
            var settingsService = new SettingsService(profileService.SettingsFilePath, loggingService);
            var settings = await settingsService.LoadAsync();
            var navigationPolicy = new NavigationPolicyService();
            var cosmeticFilterService = new CosmeticFilterService(loggingService);
            var filterListProvider = new LocalFilterListProvider();
            var filterEngine = new FilterEngine(filterListProvider, loggingService);
            var browserService = new BrowserService(
                profileService,
                loggingService,
                navigationPolicy,
                cosmeticFilterService,
                filterEngine,
                settings);
            var viewModel = new MainViewModel(browserService);
            var window = new MainWindow(
                viewModel,
                browserService,
                settingsService,
                settings,
                loggingService);
            MainWindow = window;
            window.Show();
        }
        catch (Exception exception)
        {
            loggingService.Error("Application startup failed.", exception);
            MessageBox.Show(
                "MyTube could not start. See the local log for details.",
                "MyTube",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            Shutdown(1);
        }
    }
}
