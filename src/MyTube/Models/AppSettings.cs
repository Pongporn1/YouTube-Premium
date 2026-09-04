namespace MyTube.Models;

public sealed class AppSettings
{
    public const int CurrentSchemaVersion = 2;

    public int SettingsSchemaVersion { get; set; } = CurrentSchemaVersion;

    public bool OpenYouTubeOnStartup { get; set; } = true;

    public bool RememberSession { get; set; } = true;

    public bool YouTubeOnlyMode { get; set; } = true;

    public bool HideShorts { get; set; }

    public bool HideHomeFeed { get; set; }

    public bool HideRecommendations { get; set; }

    public bool HideComments { get; set; }

    public bool HideMerch { get; set; }

    public bool HidePromotions { get; set; } = true;

    public bool HidePopups { get; set; } = true;

    public bool FocusMode { get; set; }

    public bool EnableContentFiltering { get; set; } = true;

    public bool BlockKnownTrackers { get; set; } = true;

    public bool ClearCacheOnExit { get; set; }

    public bool ClearCookiesOnExit { get; set; }

    public bool EnableDebugLogging { get; set; }

    public bool EnableDevTools { get; set; }

    public bool Telemetry { get; set; }

    public AppSettings Clone()
    {
        var clone = new AppSettings();
        clone.CopyFrom(this);
        return clone;
    }

    public void CopyFrom(AppSettings source)
    {
        SettingsSchemaVersion = CurrentSchemaVersion;
        OpenYouTubeOnStartup = source.OpenYouTubeOnStartup;
        RememberSession = source.RememberSession;
        YouTubeOnlyMode = source.YouTubeOnlyMode;
        HideShorts = source.HideShorts;
        HideHomeFeed = source.HideHomeFeed;
        HideRecommendations = source.HideRecommendations;
        HideComments = source.HideComments;
        HideMerch = source.HideMerch;
        HidePromotions = source.HidePromotions;
        HidePopups = source.HidePopups;
        FocusMode = source.FocusMode;
        EnableContentFiltering = source.EnableContentFiltering;
        BlockKnownTrackers = source.BlockKnownTrackers;
        ClearCacheOnExit = source.ClearCacheOnExit;
        ClearCookiesOnExit = source.ClearCookiesOnExit;
        EnableDebugLogging = source.EnableDebugLogging;
        EnableDevTools = source.EnableDevTools;
        Telemetry = false;
    }
}
