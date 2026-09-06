using System.Windows;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;
using MyTube.Models;
using MyTube.Services;

namespace MyTube.Views;

// A separate WebView2 sharing the main window's environment and profile: the
// music.youtube.com session here keeps playing while the main window navigates
// anywhere, is minimized, or shrinks into the mini player.
public partial class MusicWindow : Window
{
    private readonly AppSettings _settings;
    private readonly CoreWebView2Environment _environment;
    private readonly BrowserService _browserService;
    private readonly LoggingService _logger;
    private bool _initialized;

    public MusicWindow(AppSettings settings, CoreWebView2Environment environment)
    {
        InitializeComponent();
        _settings = settings;
        _environment = environment;
        var profileService = new ProfileService();
        _logger = new LoggingService(profileService.LogDirectory);
        _browserService = new BrowserService(
            profileService,
            _logger,
            new NavigationPolicyService(),
            new CosmeticFilterService(_logger),
            new FilterEngine(new LocalFilterListProvider(), _logger),
            settings);

        var workArea = SystemParameters.WorkArea;
        Left = workArea.Right - Width - 12;
        Top = workArea.Bottom - Height - 12;
    }

    public bool IsSuspended => _browserService.IsSuspended;

    public Task<string?> ExecuteScriptAsyncSafe(string script) => _browserService.ExecuteScriptAsyncSafe(script);

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (_initialized)
        {
            return;
        }

        _initialized = true;
        try
        {
            await _browserService.InitializeAsync(Player, BrowserService.MusicUri, _environment);
        }
        catch (Exception exception)
        {
            _logger.Error("The music window could not initialize.", exception);
            MessageBox.Show(
                "MyTube Music ไม่สามารถเปิดได้ ปิดหน้าต่างนี้แล้วเปิดใหม่จากปุ่ม ♫ อีกครั้ง",
                "MyTube",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private void OnTitleBarMouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ChangedButton == MouseButton.Left)
        {
            try
            {
                DragMove();
            }
            catch (InvalidOperationException)
            {
                // The button was released before DragMove started; nothing to move.
            }
        }
    }

    private void OnTopmostClick(object sender, RoutedEventArgs e)
    {
        Topmost = !Topmost;
        TopmostButton.Content = Topmost ? "\u2691" : "\u2690";
    }

    private void OnCloseClick(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Escape)
        {
            Close();
            e.Handled = true;
        }
    }

    private void OnClosed(object? sender, EventArgs e)
    {
        _browserService.Dispose();
        _logger.Info("Music window closed.");
    }
}
