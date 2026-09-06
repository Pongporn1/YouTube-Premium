using Windows.Media;
using Windows.Storage.Streams;

namespace MyTube.Services;

public enum MediaTransportButton
{
    Play,
    Pause,
    Next,
    Previous,
    Stop,
}

// Bridges the WPF window to Windows' System Media Transport Controls — the
// media surface behind hardware play/pause keys, the lock screen, and the
// taskbar flyout. The app pushes the player's state/metadata and receives
// hardware button presses back.
public sealed class MediaTransportService
{
    private SystemMediaTransportControls? _controls;
    private string _lastMetaKey = string.Empty;

    public event EventHandler<MediaTransportButton>? ButtonPressed;

    public bool Attach(IntPtr windowHandle)
    {
        try
        {
            _controls = SystemMediaTransportControlsInterop.GetForWindow(windowHandle);
            _controls.IsEnabled = true;
            _controls.IsPlayEnabled = true;
            _controls.IsPauseEnabled = true;
            _controls.IsNextEnabled = true;
            _controls.IsPreviousEnabled = true;
            _controls.ButtonPressed += OnButtonPressed;
            return true;
        }
        catch (Exception)
        {
            _controls = null;
            return false;
        }
    }

    private void OnButtonPressed(SystemMediaTransportControls sender, SystemMediaTransportControlsButtonPressedEventArgs args)
    {
        var button = args.Button switch
        {
            SystemMediaTransportControlsButton.Play => MediaTransportButton.Play,
            SystemMediaTransportControlsButton.Pause => MediaTransportButton.Pause,
            SystemMediaTransportControlsButton.Next => MediaTransportButton.Next,
            SystemMediaTransportControlsButton.Previous => MediaTransportButton.Previous,
            SystemMediaTransportControlsButton.Stop => MediaTransportButton.Stop,
            _ => (MediaTransportButton?)null,
        };

        if (button is { } value)
        {
            ButtonPressed?.Invoke(this, value);
        }
    }

    public void Update(string title, string artist, string? thumbnailUrl, bool playing)
    {
        if (_controls is null)
        {
            return;
        }

        try
        {
            var status = playing ? MediaPlaybackStatus.Playing : MediaPlaybackStatus.Paused;
            if (_controls.PlaybackStatus != status)
            {
                _controls.PlaybackStatus = status;
            }

            var metaKey = $"{title}|{artist}|{thumbnailUrl}";
            if (metaKey == _lastMetaKey)
            {
                return;
            }

            _lastMetaKey = metaKey;
            var updater = _controls.DisplayUpdater;
            updater.Type = MediaPlaybackType.Music;
            updater.MusicProperties.Title = title;
            updater.MusicProperties.Artist = artist;
            if (!string.IsNullOrWhiteSpace(thumbnailUrl) && Uri.TryCreate(thumbnailUrl, UriKind.Absolute, out var thumbnail))
            {
                updater.Thumbnail = RandomAccessStreamReference.CreateFromUri(thumbnail);
            }
            else
            {
                updater.Thumbnail = null;
            }

            updater.Update();
        }
        catch (Exception)
        {
            // SMTC is best-effort: a failed metadata push must never disturb playback.
        }
    }
}
