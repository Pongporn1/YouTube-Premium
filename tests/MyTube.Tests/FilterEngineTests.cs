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
