using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Threading;
using MyTube.Models;
using MyTube.Services;

namespace MyTubeMusic.Views;

// A dedicated, resource-lean music companion for gaming sessions:
// GPU acceleration off, below-normal process priority, a small disk cache,
// MyTube's full ad/tracker filtering, and Windows media-key support —
// nothing else. It plays music.youtube.com with its own persistent profile.
public partial class MainWindow : Window
{
    private const string PlayerQueryScript = @"
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

    private readonly ProfileService _profileService = new("MyTubeMusic");
    private readonly LoggingService _logger;
    private readonly BrowserService _browserService;
    private readonly MediaTransportService _mediaTransport = new();
    private readonly DispatcherTimer _mediaPollTimer;
    private bool _initialized;

    public MainWindow()
    {
        InitializeComponent();
        _logger = new LoggingService(_profileService.LogDirectory);
        _browserService = new BrowserService(
            _profileService,
            _logger,
            new NavigationPolicyService(),
            new CosmeticFilterService(_logger),
            new FilterEngine(new LocalFilterListProvider(), _logger),
            new AppSettings(),
            // GPU stays free for the game; music pages are audio-first and
            // render fine on the CPU at this window size.
            additionalBrowserArguments: "--disable-gpu --process-per-site --renderer-process-limit=1 --disk-cache-size=134217728");
        _mediaTransport.ButtonPressed += OnMediaTransportButtonPressed;
        _mediaPollTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        _mediaPollTimer.Tick += OnMediaPollTick;

        try
        {
            var iconPath = System.IO.Path.Combine(AppContext.BaseDirectory, "Resources", "app.ico");
            if (System.IO.File.Exists(iconPath))
            {
                Icon = System.Windows.Media.Imaging.BitmapFrame.Create(new Uri(iconPath));
            }
        }
        catch (Exception)
        {
            // A missing window icon is cosmetic only.
        }

        var workArea = SystemParameters.WorkArea;
        Left = workArea.Right - Width - 12;
        Top = workArea.Top + 12;
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        if (!_mediaTransport.Attach(new WindowInteropHelper(this).Handle))
        {
            return;
        }

        _mediaPollTimer.Start();
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
            await _browserService.InitializeAsync(Player, BrowserService.MusicUri);
        }
        catch (Exception exception)
        {
            _logger.Error("The music player could not initialize.", exception);
            MessageBox.Show(
                "MyTube Music ไม่สามารถเปิดได้ ตรวจว่าติดตั้ง WebView2 Runtime แล้วลองเปิดใหม่",
                "MyTube Music",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private async void OnMediaPollTick(object? sender, EventArgs e)
    {
        try
        {
            var state = ParseMediaState(await _browserService.ExecuteScriptAsyncSafe(PlayerQueryScript));
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

                await _browserService.ExecuteScriptAsyncSafe(PlayerCommandScript(action));
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
            var json = System.Text.Json.JsonSerializer.Deserialize<string>(scriptResult);
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            using var document = System.Text.Json.JsonDocument.Parse(json);
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
        _mediaPollTimer.Stop();
        _browserService.Dispose();
        _logger.Info("MyTube Music closed.");
    }
}
