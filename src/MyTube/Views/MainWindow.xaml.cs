using System.Diagnostics;
using System.ComponentModel;
using System.Windows;
using System.Windows.Input;
using Microsoft.Web.WebView2.Wpf;
using MyTube.Models;
using MyTube.Services;
using MyTube.ViewModels;

namespace MyTube.Views;

public partial class MainWindow : Window
{
    private readonly MainViewModel _viewModel;
    private readonly BrowserService _browserService;
    private readonly SettingsService _settingsService;
    private readonly AppSettings _settings;
    private readonly LoggingService _logger;
    private bool _initialized;
    private bool _shutdownComplete;
    private bool _appFullscreen;
    private WindowStyle _previousWindowStyle;
    private ResizeMode _previousResizeMode;
    private WindowState _previousWindowState;
    private int _browserRecreateAttempts;

    public MainWindow(
        MainViewModel viewModel,
        BrowserService browserService,
        SettingsService settingsService,
        AppSettings settings,
        LoggingService logger)
    {
        InitializeComponent();
        _viewModel = viewModel;
        _browserService = browserService;
        _settingsService = settingsService;
        _settings = settings;
        _logger = logger;
        DataContext = viewModel;
        _browserService.ExternalNavigationRequested += OnExternalNavigationRequested;
        _browserService.DownloadRequested += OnDownloadRequested;
        _browserService.BrowserProcessFailed += OnBrowserProcessFailed;
        _browserService.BrowserAvailabilityChanged += OnBrowserAvailabilityChanged;
        _viewModel.SettingsRequested += OnSettingsRequested;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (_initialized)
        {
            return;
        }

        _initialized = true;
        try
        {
            await _viewModel.InitializeAsync(Browser);
            LoadingPanel.Visibility = Visibility.Collapsed;
        }
        catch (Exception exception)
        {
            LoadingPanel.Visibility = Visibility.Collapsed;
            _logger.Error("WebView2 initialization failed.", exception);
            MessageBox.Show(
                "MyTube could not initialize WebView2. Install or repair the Microsoft Edge WebView2 Evergreen Runtime and try again.",
                "MyTube",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        _browserService.ExternalNavigationRequested -= OnExternalNavigationRequested;
        _browserService.DownloadRequested -= OnDownloadRequested;
        _browserService.BrowserProcessFailed -= OnBrowserProcessFailed;
        _browserService.BrowserAvailabilityChanged -= OnBrowserAvailabilityChanged;
        _viewModel.SettingsRequested -= OnSettingsRequested;
        _browserService.Dispose();
        _logger.Info("Application closed.");
    }

    private async void OnClosing(object? sender, CancelEventArgs e)
    {
        if (_shutdownComplete)
        {
            return;
        }

        e.Cancel = true;
        try
        {
            await _browserService.PrepareForShutdownAsync();
        }
        catch (Exception exception)
        {
            _logger.Error("Could not clear selected browsing data on exit.", exception);
        }

        _shutdownComplete = true;
        Close();
    }

    private async void OnSettingsRequested(object? sender, EventArgs e)
    {
        var settingsViewModel = new SettingsViewModel(_settings);
        var window = new SettingsWindow(settingsViewModel)
        {
            Owner = this,
        };

        if (window.ShowDialog() != true)
        {
            return;
        }

        settingsViewModel.ApplyTo(_settings);
        await _settingsService.SaveAsync(_settings);
        await _browserService.ApplySettingsAsync();
        _logger.Info("Settings saved.");
    }

    private async void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        var key = e.Key == Key.System ? e.SystemKey : e.Key;
        var modifiers = Keyboard.Modifiers;

        if (key == Key.F11)
        {
            ToggleApplicationFullscreen();
            e.Handled = true;
            return;
        }

        if (key == Key.Escape && _appFullscreen)
        {
            ExitApplicationFullscreen();
            e.Handled = true;
            return;
        }

        if (key == Key.Left && modifiers.HasFlag(ModifierKeys.Alt))
        {
            _browserService.GoBack();
            e.Handled = true;
            return;
        }

        if (key == Key.Right && modifiers.HasFlag(ModifierKeys.Alt))
        {
            _browserService.GoForward();
            e.Handled = true;
            return;
        }

        if (key == Key.R && modifiers == ModifierKeys.Control)
        {
            _browserService.Reload();
            e.Handled = true;
            return;
        }

        if (key == Key.L && modifiers == ModifierKeys.Control)
        {
            e.Handled = true;
            return;
        }

        if (key == Key.F
            && modifiers.HasFlag(ModifierKeys.Control)
            && modifiers.HasFlag(ModifierKeys.Shift))
        {
            _settings.FocusMode = !_settings.FocusMode;
            await _settingsService.SaveAsync(_settings);
            await _browserService.ApplySettingsAsync();
            _logger.Info($"Focus Mode toggled. Enabled={_settings.FocusMode}");
            e.Handled = true;
            return;
        }

        if (key == Key.F12)
        {
            _browserService.OpenDevTools();
            e.Handled = _settings.EnableDevTools;
        }
    }

    private void ToggleApplicationFullscreen()
    {
        if (_appFullscreen)
        {
            ExitApplicationFullscreen();
            return;
        }

        _previousWindowStyle = WindowStyle;
        _previousResizeMode = ResizeMode;
        _previousWindowState = WindowState;
        _appFullscreen = true;
        Toolbar.Visibility = Visibility.Collapsed;
        ToolbarRow.Height = new GridLength(0);
        WindowStyle = WindowStyle.None;
        ResizeMode = ResizeMode.NoResize;
        WindowState = WindowState.Maximized;
    }

    private void ExitApplicationFullscreen()
    {
        if (!_appFullscreen)
        {
            return;
        }

        _appFullscreen = false;
        WindowStyle = _previousWindowStyle;
        ResizeMode = _previousResizeMode;
        WindowState = _previousWindowState;
        ToolbarRow.Height = new GridLength(46);
        Toolbar.Visibility = Visibility.Visible;
    }

    private void OnExternalNavigationRequested(object? sender, ExternalNavigationEventArgs e)
    {
        Dispatcher.Invoke(() =>
        {
            var dialog = new ExternalLinkDialog(e.Uri)
            {
                Owner = this,
            };

            if (dialog.ShowDialog() != true)
            {
                return;
            }

            try
            {
                Process.Start(new ProcessStartInfo(e.Uri.AbsoluteUri)
                {
                    UseShellExecute = true,
                });
                _logger.Info($"User opened an external link in the default browser. Host={e.Uri.IdnHost}");
            }
            catch (Exception exception)
            {
                _logger.Error("Could not open the external link in the default browser.", exception);
                MessageBox.Show(
                    "Windows could not open this link in the default browser.",
                    "MyTube",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        });
    }

    private void OnDownloadRequested(object? sender, DownloadRequestEventArgs e)
    {
        var result = MessageBox.Show(
            $"This page requested a download.\n\nFile: {e.FileName}\n\nMyTube does not include a YouTube video downloader. Allow this download and show the WebView2 download UI?",
            "Download requested",
            MessageBoxButton.YesNo,
            MessageBoxImage.Question,
            MessageBoxResult.No);
        e.IsAllowed = result == MessageBoxResult.Yes;
    }

    private async void OnBrowserProcessFailed(object? sender, BrowserFailureEventArgs e)
    {
        if (e.Kind == BrowserFailureKind.Renderer)
        {
            var result = MessageBox.Show(
                "YouTube renderer stopped unexpectedly. Reload the page?",
                "MyTube",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning,
                MessageBoxResult.Yes);
            if (result == MessageBoxResult.Yes)
            {
                _browserService.Reload();
            }

            return;
        }

        if (e.Kind != BrowserFailureKind.Browser || _browserRecreateAttempts >= 1)
        {
            MessageBox.Show(
                "The WebView2 browser process stopped. Close and reopen MyTube to continue.",
                "MyTube",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
            return;
        }

        var recovery = MessageBox.Show(
            "The WebView2 browser process stopped. Recreate the browser once?",
            "MyTube",
            MessageBoxButton.YesNo,
            MessageBoxImage.Warning,
            MessageBoxResult.Yes);
        if (recovery != MessageBoxResult.Yes)
        {
            return;
        }

        _browserRecreateAttempts++;
        try
        {
            var replacement = new WebView2();
            BrowserHost.Children.Remove(Browser);
            Browser = replacement;
            BrowserHost.Children.Insert(0, replacement);
            await _viewModel.InitializeAsync(replacement);
        }
        catch (Exception exception)
        {
            _logger.Error("WebView2 browser recovery failed.", exception);
            MessageBox.Show(
                "MyTube could not recreate the browser. Close and reopen the app.",
                "MyTube",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private void OnBrowserAvailabilityChanged(object? sender, BrowserAvailabilityEventArgs e)
    {
        ConnectionErrorPanel.Visibility = e.IsAvailable
            ? Visibility.Collapsed
            : Visibility.Visible;
    }

    private void OnRetry(object sender, RoutedEventArgs e)
    {
        ConnectionErrorPanel.Visibility = Visibility.Collapsed;
        _browserService.Reload();
    }
}
