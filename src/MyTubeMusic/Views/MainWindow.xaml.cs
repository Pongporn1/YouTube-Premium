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
      thumb: imageEl ? imageEl.src : '',
      volume: video ? video.volume : 1,
      muted: video ? !!video.muted : false
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
    private readonly string _volumeFilePath;
    private bool _initialized;
    private bool _muted;
    private bool _syncingVolume;

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
        _volumeFilePath = System.IO.Path.Combine(_profileService.LocalDataDirectory, "ui-volume.txt");

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
            ApplySavedVolume();
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

    // The music page resets its volume on reload, so the app keeps the last
    // value itself and re-applies it after every launch.
    private void ApplySavedVolume()
    {
        try
        {
            if (!System.IO.File.Exists(_volumeFilePath))
            {
                return;
            }

            var parts = System.IO.File.ReadAllText(_volumeFilePath).Split('|');
            if (int.TryParse(parts[0], out var volume))
            {
                _syncingVolume = true;
                VolumeSlider.Value = Math.Clamp(volume, 0, 100);
                _syncingVolume = false;
            }

            if (parts.Length > 1)
            {
                _muted = parts[1] == "1";
            }

            ApplyVolume();
        }
        catch (Exception)
        {
            // A missing or corrupt volume file just falls back to the page default.
        }
    }

    private void ApplyVolume()
    {
        _ = _browserService.ExecuteScriptAsyncSafe(VolumeScript(VolumeSlider.Value / 100.0, _muted));
    }

    private void PersistVolume()
    {
        try
        {
            System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(_volumeFilePath)!);
            System.IO.File.WriteAllText(_volumeFilePath, ((int)VolumeSlider.Value).ToString() + "|" + (_muted ? "1" : "0"));
        }
        catch (Exception)
        {
            // Volume persistence is cosmetic; failing to save changes nothing.
        }
    }

    private void OnMuteClick(object sender, RoutedEventArgs e)
    {
        _muted = !_muted;
        MuteButton.Content = _muted ? "\U0001F507" : "\U0001F50A";
        ApplyVolume();
        PersistVolume();
    }

    private void OnVolumeChanged(object sender, System.Windows.RoutedPropertyChangedEventArgs<double> e)
    {
        if (!_initialized || _syncingVolume)
        {
            return;
        }

        if (_muted)
        {
            _muted = false;
            MuteButton.Content = "\U0001F50A";
        }

        ApplyVolume();
        PersistVolume();
    }

    private void OnMaximizeRestoreClick(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized;
        MaximizeButton.Content = WindowState == WindowState.Maximized ? "\u2750" : "\u25A1";
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

            var thumbnail = state.Value.VideoId.Length == 11
                ? $"https://i.ytimg.com/vi/{state.Value.VideoId}/mqdefault.jpg"
                : state.Value.Thumbnail;
            _mediaTransport.Update(state.Value.Title, state.Value.Artist, thumbnail, state.Value.Playing);

            // Mirror the page's real volume/mute state onto the title bar, but
            // never fight the user while they are dragging the slider.
            if (!VolumeSlider.IsMouseCaptureWithin)
            {
                _syncingVolume = true;
                VolumeSlider.Value = Math.Clamp(current.Volume * 100.0, 0, 100);
                _syncingVolume = false;
            }
            var muteGlyph = (current.Muted || _muted) ? "\U0001F507" : "\U0001F50A";
            if (MuteButton.Content.ToString() != muteGlyph)
            {
                MuteButton.Content = muteGlyph;
            }
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

    private static string VolumeScript(double volume, bool muted) => $@"
(() => {{
  try {{
    const v = Math.max(0, Math.min(1, {volume.ToString(System.Globalization.CultureInfo.InvariantCulture)}));
    const m = {muted.ToString().ToLowerInvariant()};
    document.querySelectorAll('video, audio').forEach(el => {{
      el.volume = v;
      el.muted = m;
    }});
  }} catch (error) {{ }}
}})()";

    private static (bool Playing, string Title, string Artist, string VideoId, string Thumbnail, double Volume, bool Muted)? ParseMediaState(string? scriptResult)
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
                root.TryGetProperty("thumb", out var thumbnail) ? thumbnail.GetString() ?? "" : "",
                root.TryGetProperty("volume", out var volume) ? volume.GetDouble() : 1,
                root.TryGetProperty("muted", out var muted) && muted.GetBoolean()
            );
        }
        catch (Exception)
        {
            return null;
        }
    }

    private void OnMinimizeClick(object sender, RoutedEventArgs e)
    {
        // Folding to the taskbar keeps playback running; restore from there.
        WindowState = WindowState.Minimized;
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
