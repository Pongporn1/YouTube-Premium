using System.Diagnostics;
using System.ComponentModel;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Threading;
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
    private bool _shutdownInProgress;
    private bool _processRecoveryInProgress;
    private bool _appFullscreen;
    private System.Windows.Shell.WindowChrome? _previousChrome;
    private bool _videoFullscreen;
    private bool _videoEnteredAppFullscreen;
    private bool _miniPlayerActive;
    private Rect _preMiniBounds;
    private WindowState _preMiniState;
    private ResizeMode _preMiniResize;
    private WindowStyle _previousWindowStyle;
    private ResizeMode _previousResizeMode;
    private WindowState _previousWindowState;
    private int _browserRecreateAttempts;
    private readonly MediaTransportService _mediaTransport = new();
    private DispatcherTimer? _mediaPollTimer;

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

        try
        {
            var iconPath = System.IO.Path.Combine(AppContext.BaseDirectory, "Resources", "Branding", "MyTube.ico");
            if (System.IO.File.Exists(iconPath))
            {
                TitleIcon.Source = System.Windows.Media.Imaging.BitmapFrame.Create(new Uri(iconPath));
            }
        }
        catch (Exception)
        {
            // A missing window icon is cosmetic only.
        }
        _browserService.ExternalNavigationRequested += OnExternalNavigationRequested;
        _browserService.DownloadRequested += OnDownloadRequested;
        _browserService.BrowserProcessFailed += OnBrowserProcessFailed;
        _browserService.BrowserAvailabilityChanged += OnBrowserAvailabilityChanged;
        _browserService.FullscreenChanged += OnVideoFullscreenChanged;
        StateChanged += OnStateChanged;
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
        _browserService.FullscreenChanged -= OnVideoFullscreenChanged;
        StateChanged -= OnStateChanged;
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
        if (_shutdownInProgress)
        {
            return;
        }

        _shutdownInProgress = true;
        try
        {
            await _browserService.PrepareForShutdownAsync();
        }
        catch (Exception exception)
        {
            _logger.Error("Could not clear selected browsing data on exit.", exception);
        }

        _shutdownComplete = true;
        _ = Dispatcher.BeginInvoke(new Action(Close));
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
            if (_videoFullscreen)
                await _browserService.ExecuteScriptAsyncSafe("document.exitFullscreen().catch(() => {});");
            ExitApplicationFullscreen();
            e.Handled = true;
            return;
        }

        if (key == Key.Escape && _miniPlayerActive)
        {
            ExitMiniPlayer();
            e.Handled = true;
            return;
        }

        if (key == Key.M && modifiers == (ModifierKeys.Control | ModifierKeys.Shift))
        {
            ToggleMiniPlayer();
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
            if (_videoFullscreen)
            {
                _ = _browserService.ExecuteScriptAsyncSafe("document.exitFullscreen().catch(() => {});");
            }
            ExitApplicationFullscreen();
            return;
        }

        if (_miniPlayerActive) ExitMiniPlayer();
        _previousWindowStyle = WindowStyle;
        _previousResizeMode = ResizeMode;
        _previousWindowState = WindowState;
        _appFullscreen = true;
        _previousChrome = System.Windows.Shell.WindowChrome.GetWindowChrome(this);
        WindowState = WindowState.Normal;
        System.Windows.Shell.WindowChrome.SetWindowChrome(this, null);
        TitleBarRow.Height = new GridLength(0);
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
        WindowState = WindowState.Normal;
        System.Windows.Shell.WindowChrome.SetWindowChrome(this, _previousChrome);
        WindowStyle = _previousWindowStyle;
        ResizeMode = _previousResizeMode;
        WindowState = _previousWindowState;
        TitleBarRow.Height = new GridLength(48);
    }

    private void OnVideoFullscreenChanged(object? sender, bool fullscreen)
    {
        _videoFullscreen = fullscreen;
        if (fullscreen)
        {
            _videoEnteredAppFullscreen = !_appFullscreen;
            if (_videoEnteredAppFullscreen) ToggleApplicationFullscreen();
        }
        else
        {
            if (_videoEnteredAppFullscreen) ExitApplicationFullscreen();
            _videoEnteredAppFullscreen = false;
        }
    }

    private void OnMusicClick(object sender, RoutedEventArgs e)
    {
        try
        {
            var player = System.IO.Path.GetFullPath(System.IO.Path.Combine(
                AppContext.BaseDirectory, "..", "music-x64", "MyTubeMusic.exe"));
            if (!System.IO.File.Exists(player))
                throw new System.IO.FileNotFoundException("MyTube Music is not installed next to MyTube.", player);
            Process.Start(new ProcessStartInfo(player)
            {
                UseShellExecute = true,
                WorkingDirectory = System.IO.Path.GetDirectoryName(player)!,
            });
        }
        catch (Exception exception)
        {
            _logger.Error("The music window could not be opened.", exception);
            MessageBox.Show("MyTube Music could not be opened. Please install the music companion next to MyTube.", "MyTube");
        }
    }

    private void OnMiniPlayerClick(object sender, RoutedEventArgs e)
    {
        if (_appFullscreen)
        {
            return;
        }

        ToggleMiniPlayer();
    }

    private void OnMinimizeWindowClick(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void OnMaximizeRestoreClick(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
    }

    private void OnCloseWindowClick(object sender, RoutedEventArgs e)
    {
        Close();
    }

    // Shrinks the whole window to a small always-on-top rectangle: the video
    // keeps playing in the same WebView2 session while other apps stay visible.
    private void ToggleMiniPlayer()
    {
        if (_miniPlayerActive)
        {
            ExitMiniPlayer();
        }
        else
        {
            EnterMiniPlayer();
        }
    }

    private void EnterMiniPlayer()
    {
        if (_miniPlayerActive || _appFullscreen)
        {
            return;
        }

        _miniPlayerActive = true;
        _preMiniBounds = new Rect(Left, Top, ActualWidth, ActualHeight);
        _preMiniState = WindowState;
        _preMiniResize = ResizeMode;

        if (WindowState != WindowState.Normal)
        {
            WindowState = WindowState.Normal;
        }

        Width = 428;
        Height = 294;
        var workArea = SystemParameters.WorkArea;
        Left = workArea.Right - ActualWidth - 12;
        Top = workArea.Bottom - ActualHeight - 12;

        ResizeMode = ResizeMode.NoResize;
        Topmost = true;
        // Mini mode slims the integrated title bar: navigation and settings hide,
        // the caption text explains that dragging happens there.
        NavStack.Visibility = Visibility.Collapsed;
        SettingsButton.Visibility = Visibility.Collapsed;
        TitleText.Text = "MyTube mini — ลากแถบหัวเพื่อย้าย";
        MiniPlayerButton.ToolTip = "Exit mini player (Ctrl+Shift+M)";
    }

    private void ExitMiniPlayer()
    {
        if (!_miniPlayerActive)
        {
            return;
        }

        _miniPlayerActive = false;
        Topmost = false;
        ResizeMode = _preMiniResize;
        NavStack.Visibility = Visibility.Visible;
        SettingsButton.Visibility = Visibility.Visible;
        TitleText.Text = "MyTube Premium";
        MiniPlayerButton.ToolTip = "Mini player always on top (Ctrl+Shift+M)";
        Left = _preMiniBounds.Left;
        Top = _preMiniBounds.Top;
        Width = _preMiniBounds.Width;
        Height = _preMiniBounds.Height;
        WindowState = _preMiniState;
    }

    private sealed record MediaState(bool Playing, string Title, string Artist, string VideoId, string Thumbnail);

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        if (!_mediaTransport.Attach(new WindowInteropHelper(this).Handle))
        {
            return;
        }

        _mediaTransport.ButtonPressed += OnMediaTransportButtonPressed;
        _mediaPollTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        _mediaPollTimer.Tick += OnMediaPollTick;
        _mediaPollTimer.Start();
    }

    private async void OnMediaPollTick(object? sender, EventArgs e)
    {
        try
        {
            var mainState = _browserService.IsSuspended
                ? null
                : ParseMediaState(await _browserService.ExecuteScriptAsyncSafe(PlayerQueryScript));
            // The standalone music player owns its own Windows media session.
            var state = mainState;
            if (state is not { } current)
            {
                return;
            }

            var thumbnail = current.VideoId.Length == 11
                ? $"https://i.ytimg.com/vi/{current.VideoId}/mqdefault.jpg"
                : current.Thumbnail;
            _mediaTransport.Update(current.Title, current.Artist, thumbnail, current.Playing);
        }
        catch (Exception)
        {
            // The media-key bridge is best-effort; a missed poll retries in a second.
        }
    }

    private void OnMediaTransportButtonPressed(object? sender, MediaTransportButton button)
    {
        Dispatcher.BeginInvoke(new Action(async () =>
        {
            try
            {
                if (_browserService.IsSuspended)
                {
                    // A suspended renderer cannot honor keys; wake it first.
                    await _browserService.SetSuspendedAsync(false);
                }

                var action = button switch
                {
                    MediaTransportButton.Play => "play",
                    MediaTransportButton.Pause => "pause",
                    MediaTransportButton.Next => "next",
                    MediaTransportButton.Previous => "previous",
                    _ => "",
                };
                if (action.Length == 0)
                {
                    return;
                }

                var script = PlayerCommandScript(action);
                await _browserService.ExecuteScriptAsyncSafe(script);
            }
            catch (Exception)
            {
                // Best-effort commands; playback state recovers on the next poll.
            }
        }));
    }

    private static (bool Playing, string Title, string Artist, string VideoId, string Thumbnail)? ParseMediaState(string? scriptResult)
    {
        if (string.IsNullOrWhiteSpace(scriptResult))
        {
            return null;
        }

        try
        {
            // ExecuteScriptAsync wraps the script's JSON return value in a JSON string.
            var json = JsonSerializer.Deserialize<string>(scriptResult);
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            return (
                root.TryGetProperty("playing", out var playing) && playing.GetBoolean(),
                root.TryGetProperty("title", out var title) ? title.GetString() ?? "" : "",
                root.TryGetProperty("author", out var author) ? author.GetString() ?? "" : "",
                root.TryGetProperty("videoId", out var videoId) ? videoId.GetString() ?? "" : "",
                root.TryGetProperty("thumb", out var thumbnail) ? thumbnail.GetString() ?? "" : ""
            );
        }
        catch (Exception)
        {
            return null;
        }
    }

    private const string PlayerQueryScript = @"
(() => {
  try {
    const mp = document.getElementById('movie_player');
    const video = document.querySelector('video');
    const playing = !!(video && !video.paused && !video.ended) || !!(mp && mp.getPlayerState && mp.getPlayerState() === 1);
    let title = '';
    let author = '';
    let videoId = '';
    if (mp && mp.getVideoData) {
      const data = mp.getVideoData();
      title = data.title || '';
      author = data.author || '';
      videoId = data.video_id || '';
    }
    return JSON.stringify({ playing, title, author, videoId });
  } catch (error) {
    return JSON.stringify({ playing: false, title: '', author: '', videoId: '' });
  }
})()";

    private const string MusicQueryScript = @"
(() => {
  try {
    const video = document.querySelector('video');
    const playing = !!(video && !video.paused && !video.ended);
    const titleEl = document.querySelector('.ytmusic-player-bar.title');
    const bylineEl = document.querySelector('.ytmusic-player-bar.byline');
    const imageEl = document.querySelector('ytmusic-player-bar img');
    let videoId = '';
    const link = document.querySelector('ytmusic-player-bar a[href*=""watch?v=""]');
    if (link) {
      const match = /(?:v=)([A-Za-z0-9_-]{11})/.exec(link.getAttribute('href') || '');
      if (match) videoId = match[1];
    }
    return JSON.stringify({
      playing,
      title: titleEl ? titleEl.textContent : '',
      author: bylineEl ? bylineEl.textContent : '',
      videoId,
      thumb: imageEl ? imageEl.src : ''
    });
  } catch (error) {
    return JSON.stringify({ playing: false, title: '', author: '', videoId: '', thumb: '' });
  }
})()";

    private static string PlayerCommandScript(string action) => $@"
(() => {{
  try {{
    const mp = document.getElementById('movie_player');
    const video = document.querySelector('video');
    if (mp && action === 'play' && mp.playVideo) {{ mp.playVideo(); return; }}
    if (mp && action === 'pause' && mp.pauseVideo) {{ mp.pauseVideo(); return; }}
    if (mp && action === 'next' && mp.nextVideo) {{ mp.nextVideo(); return; }}
    if (mp && action === 'previous' && mp.previousVideo) {{ mp.previousVideo(); return; }}
    if (!video) return;
    if (action === 'play' && video.paused) video.play();
    if (action === 'pause' && !video.paused) video.pause();
    if (action === 'next') document.querySelector('.ytmusic-player-bar.next-button, .ytp-next-button')?.click();
    if (action === 'previous') document.querySelector('.ytmusic-player-bar.previous-button, .ytp-prev-button')?.click();
  }} catch (error) {{ }}
}})()";

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

    private async void OnStateChanged(object? sender, EventArgs e)
    {
        MaximizeButton.Content = WindowState == WindowState.Maximized ? "\u2750" : "\u25A1";
        // The mini player is a small floating state; maximizing it (via snap or
        // programmatically) promotes the window back to the full layout.
        if (_miniPlayerActive && WindowState != WindowState.Normal)
        {
            ExitMiniPlayer();
        }

        if (_shutdownInProgress || !_initialized)
        {
            return;
        }

        await _browserService.SetSuspendedAsync(
            WindowState == WindowState.Minimized && _settings.SuspendWhenMinimized);
    }

    private void OnBrowserProcessFailed(object? sender, BrowserFailureEventArgs e)
    {
        if (e.Kind is BrowserFailureKind.Auxiliary
            or BrowserFailureKind.Other
            or BrowserFailureKind.RendererUnresponsive)
        {
            return;
        }

        OnVideoFullscreenChanged(this, false);
        _ = Dispatcher.BeginInvoke(new Action(() => _ = RecoverFromBrowserFailureAsync(e.Kind)));
    }

    private async Task RecoverFromBrowserFailureAsync(BrowserFailureKind kind)
    {
        if (_processRecoveryInProgress)
        {
            return;
        }

        _processRecoveryInProgress = true;
        try
        {
            if (kind == BrowserFailureKind.Renderer)
            {
                _browserService.Reload();
                return;
            }

            if (kind == BrowserFailureKind.Browser)
            {
                await RecreateBrowserAsync();
            }
        }
        catch (Exception exception)
        {
            _logger.Error("WebView2 process recovery failed.", exception);
        }
        finally
        {
            _processRecoveryInProgress = false;
        }
    }

    private async Task RecreateBrowserAsync()
    {
        if (_browserRecreateAttempts >= 1)
        {
            MessageBox.Show(
                "MyTube could not recover the WebView2 browser. Close and reopen the app.",
                "MyTube",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
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
