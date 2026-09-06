using MyTube.Services;

namespace MyTube.Tests;

[TestClass]
public sealed class FilterEngineTests
{
    [TestMethod]
    public async Task DomainRuleBlocksDomainAndSubdomains()
    {
        var engine = await CreateEngineAsync("BLOCK DOMAIN tracker.example.com");

        Assert.IsTrue(engine.Evaluate("https://tracker.example.com/pixel", "GET", "Image").IsBlocked);
        Assert.IsTrue(engine.Evaluate("https://a.tracker.example.com/pixel", "GET", "Image").IsBlocked);
        Assert.IsFalse(engine.Evaluate("https://tracker.example.com.attacker.test/", "GET", "Image").IsBlocked);
    }

    [TestMethod]
    public async Task AllowlistOverridesBroaderBlockRule()
    {
        var engine = await CreateEngineAsync(
            "BLOCK DOMAIN example.com",
            "ALLOW DOMAIN allowed.example.com");

        Assert.IsFalse(engine.Evaluate("https://allowed.example.com/app.js", "GET", "Script").IsBlocked);
        Assert.IsTrue(engine.Evaluate("https://blocked.example.com/app.js", "GET", "Script").IsBlocked);
    }

    [TestMethod]
    public async Task WildcardRuleMatchesWholeUrl()
    {
        var engine = await CreateEngineAsync("BLOCK WILDCARD https://*.example.net/telemetry/*");

        Assert.IsTrue(engine.Evaluate("https://api.example.net/telemetry/event", "POST", "XmlHttpRequest").IsBlocked);
        Assert.IsFalse(engine.Evaluate("https://api.example.net/content/event", "GET", "XmlHttpRequest").IsBlocked);
    }

    [TestMethod]
    public async Task ResourceTypeLimitsRule()
    {
        var engine = await CreateEngineAsync("BLOCK DOMAIN tracker.test RESOURCE Script");

        Assert.IsTrue(engine.Evaluate("https://tracker.test/code.js", "GET", "Script").IsBlocked);
        Assert.IsFalse(engine.Evaluate("https://tracker.test/image.png", "GET", "Image").IsBlocked);
    }

    [TestMethod]
    public async Task ExactAndContainsRulesWork()
    {
        var engine = await CreateEngineAsync(
            "BLOCK URL https://exact.test/pixel",
            "BLOCK URL_CONTAINS /tracking/");

        Assert.IsTrue(engine.Evaluate("https://exact.test/pixel", "GET", "Image").IsBlocked);
        Assert.IsFalse(engine.Evaluate("https://exact.test/pixel/extra", "GET", "Image").IsBlocked);
        Assert.IsTrue(engine.Evaluate("https://other.test/tracking/event", "POST", "XmlHttpRequest").IsBlocked);
    }

    [TestMethod]
    public async Task KnownAdNetworkSubdomainsAreBlockedWithoutMatchingLookalikes()
    {
        var engine = await CreateEngineAsync(
            "BLOCK DOMAIN doubleclick.net RESOURCE Script,Image,XmlHttpRequest,Other");

        Assert.IsTrue(engine.Evaluate(
            "https://securepubads.g.doubleclick.net/pagead/id",
            "GET",
            "XmlHttpRequest").IsBlocked);
        Assert.IsFalse(engine.Evaluate(
            "https://doubleclick.net.attacker.test/pagead/id",
            "GET",
            "XmlHttpRequest").IsBlocked);
        Assert.IsFalse(engine.Evaluate(
            "https://securepubads.g.doubleclick.net/video.mp4",
            "GET",
            "Media").IsBlocked);
    }

    [TestMethod]
    public async Task DefaultRulesBlockYouTubeAdControlRequestsButNotVideoPlayback()
    {
        var logDirectory = Path.Combine(Path.GetTempPath(), "MyTube.Tests", Guid.NewGuid().ToString("N"));
        var engine = new FilterEngine(
            new LocalFilterListProvider(),
            new LoggingService(logDirectory));
        await engine.InitializeAsync();

        Assert.IsTrue(engine.Evaluate(
            "https://www.youtube.com/api/stats/ads?ver=2",
            "POST",
            "XmlHttpRequest").IsBlocked);
        Assert.IsTrue(engine.Evaluate(
            "https://www.youtube.com/pagead/viewthroughconversion/123",
            "GET",
            "Other").IsBlocked);
        Assert.IsTrue(engine.Evaluate(
            "https://www.youtube.com/ptracking?event=ad",
            "POST",
            "Ping").IsBlocked);
        Assert.IsFalse(engine.Evaluate(
            "https://www.youtube.com/youtubei/v1/player",
            "POST",
            "XmlHttpRequest").IsBlocked);
        Assert.IsFalse(engine.Evaluate(
            "https://rr1---sn.example.googlevideo.com/videoplayback?id=content",
            "GET",
            "Media").IsBlocked);
    }

    private static async Task<FilterEngine> CreateEngineAsync(params string[] rules)
    {
        var logDirectory = Path.Combine(Path.GetTempPath(), "MyTube.Tests", Guid.NewGuid().ToString("N"));
        var engine = new FilterEngine(
            new InMemoryFilterListProvider(rules),
            new LoggingService(logDirectory));
        await engine.InitializeAsync();
        return engine;
    }

    private sealed class InMemoryFilterListProvider(IReadOnlyList<string> rules) : IFilterListProvider
    {
        public Task<IReadOnlyList<string>> GetRulesAsync(CancellationToken cancellationToken = default)
        {
            return Task.FromResult(rules);
        }
    }
}
