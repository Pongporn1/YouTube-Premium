using MyTube.Models;
using MyTube.Services;

namespace MyTube.Tests;

[TestClass]
public sealed class SettingsTests
{
    [TestMethod]
    public async Task SettingsRoundTripPersistsValues()
    {
        using var directory = new TemporaryDirectory();
        var path = Path.Combine(directory.Path, "settings.json");
        var service = CreateService(path, directory.Path);
        var expected = new AppSettings
        {
            YouTubeOnlyMode = false,
            HideShorts = true,
            HideComments = true,
            FocusMode = true,
            ClearCookiesOnExit = true,
        };

        await service.SaveAsync(expected);
        var actual = await service.LoadAsync();

        Assert.IsTrue(actual.HideShorts);
        Assert.IsTrue(actual.YouTubeOnlyMode);
        Assert.IsTrue(actual.HideComments);
        Assert.IsTrue(actual.FocusMode);
        Assert.IsTrue(actual.ClearCookiesOnExit);
        Assert.IsFalse(actual.Telemetry);
    }

    [TestMethod]
    public async Task CorruptedJsonFallsBackToSafeDefaults()
    {
        using var directory = new TemporaryDirectory();
        var path = Path.Combine(directory.Path, "settings.json");
        await File.WriteAllTextAsync(path, "{not valid json");
        var service = CreateService(path, directory.Path);

        var settings = await service.LoadAsync();

        Assert.IsTrue(settings.OpenYouTubeOnStartup);
        Assert.IsTrue(settings.RememberSession);
        Assert.IsTrue(settings.YouTubeOnlyMode);
        Assert.IsTrue(settings.EnableContentFiltering);
        Assert.IsTrue(settings.HidePromotions);
        Assert.IsFalse(settings.Telemetry);
    }

    [TestMethod]
    public async Task OlderSettingsEnableSafePromotionHidingMigration()
    {
        using var directory = new TemporaryDirectory();
        var path = Path.Combine(directory.Path, "settings.json");
        await File.WriteAllTextAsync(
            path,
            "{\"SettingsSchemaVersion\":1,\"HidePromotions\":false}");
        var service = CreateService(path, directory.Path);

        var settings = await service.LoadAsync();

        Assert.AreEqual(AppSettings.CurrentSchemaVersion, settings.SettingsSchemaVersion);
        Assert.IsTrue(settings.HidePromotions);
    }

    private static SettingsService CreateService(string path, string directory)
    {
        return new SettingsService(path, new LoggingService(directory));
    }

    private sealed class TemporaryDirectory : IDisposable
    {
        public TemporaryDirectory()
        {
            Path = System.IO.Path.Combine(
                System.IO.Path.GetTempPath(),
                "MyTube.Tests",
                Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Path);
        }

        public string Path { get; }

        public void Dispose()
        {
            if (Directory.Exists(Path))
            {
                Directory.Delete(Path, true);
            }
        }
    }
}
