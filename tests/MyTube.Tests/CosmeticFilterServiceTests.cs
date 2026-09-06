using MyTube.Models;
using MyTube.Services;

namespace MyTube.Tests;

[TestClass]
public sealed class CosmeticFilterServiceTests
{
    [TestMethod]
    public void PlayerAdSuppressionIsIncludedWhenPromotionsAreHidden()
    {
        var logDirectory = Path.Combine(Path.GetTempPath(), "MyTube.Tests", Guid.NewGuid().ToString("N"));
        var service = new CosmeticFilterService(new LoggingService(logDirectory));

        var script = service.CreateScript(new AppSettings { HidePromotions = true });

        Assert.IsFalse(script.Contains("__MYTUBE_CSS_JSON__", StringComparison.Ordinal));
        Assert.IsFalse(script.Contains("__MYTUBE_BLOCK_PLAYER_ADS__", StringComparison.Ordinal));
        StringAssert.Contains(script, "const blockPlayerAds = true;");
        StringAssert.Contains(script, "host.endsWith(\".youtube.com\")");
        StringAssert.Contains(script, ".html5-video-player.ad-showing");
        StringAssert.Contains(script, "MutationObserver");
        StringAssert.Contains(script, "style.textContent !== state.css");
        Assert.IsFalse(script.Contains("setInterval", StringComparison.Ordinal));
        Assert.IsFalse(script.Contains("subtree: true", StringComparison.Ordinal));
        StringAssert.Contains(script, "maxDiscoveryAttempts = 20");
        StringAssert.Contains(script, "video.currentTime = video.duration");
        StringAssert.Contains(script, "video.playbackRate = 16");
        StringAssert.Contains(script, ".ytp-ad-skip-button-modern");
        StringAssert.Contains(script, "button[class*='ytp-ad-skip']");
        StringAssert.Contains(script, "#masthead-ad");
        StringAssert.Contains(script, ".ytp-ad-badge");
        StringAssert.Contains(script, "JSON.parse");
        StringAssert.Contains(script, "adPlacements");
        StringAssert.Contains(script, "ytInitialPlayerResponse");
    }

    [TestMethod]
    public void PlayerAdSuppressionRemainsEnabledWhenFeedPromotionsAreShown()
    {
        var logDirectory = Path.Combine(Path.GetTempPath(), "MyTube.Tests", Guid.NewGuid().ToString("N"));
        var service = new CosmeticFilterService(new LoggingService(logDirectory));

        var script = service.CreateScript(new AppSettings
        {
            HidePromotions = false,
            FocusMode = false,
        });

        StringAssert.Contains(script, "const blockPlayerAds = true;");
        StringAssert.Contains(script, ".video-ads.ytp-ad-module");
    }
}
