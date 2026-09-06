using System.IO;
using System.Text.Json;
using MyTube.Models;

namespace MyTube.Services;

public sealed class SettingsService
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
    };

    private readonly string _settingsFilePath;
    private readonly LoggingService _logger;

    public SettingsService(string settingsFilePath, LoggingService logger)
    {
        _settingsFilePath = settingsFilePath;
        _logger = logger;
    }

    public async Task<AppSettings> LoadAsync(CancellationToken cancellationToken = default)
    {
        if (!File.Exists(_settingsFilePath))
        {
            return new AppSettings();
        }

        try
        {
            AppSettings? settings;
            await using (var stream = File.OpenRead(_settingsFilePath))
            {
                settings = await JsonSerializer.DeserializeAsync<AppSettings>(
                    stream,
                    SerializerOptions,
                    cancellationToken);
            }
            if (settings is null)
            {
                throw new JsonException("Settings file contained no settings object.");
            }

            var settingsWereMigrated = settings.SettingsSchemaVersion < AppSettings.CurrentSchemaVersion;
            Migrate(settings);
            settings.Telemetry = false;
            settings.YouTubeOnlyMode = true;
            if (settingsWereMigrated)
            {
                await SaveAsync(settings, cancellationToken);
            }
            return settings;
        }
        catch (Exception exception) when (exception is JsonException or IOException or UnauthorizedAccessException)
        {
            _logger.Error("Settings could not be loaded; safe defaults will be used.", exception);
            return new AppSettings();
        }
    }

    public async Task SaveAsync(AppSettings settings, CancellationToken cancellationToken = default)
    {
        settings.SettingsSchemaVersion = AppSettings.CurrentSchemaVersion;
        settings.Telemetry = false;
        settings.YouTubeOnlyMode = true;
        var directory = Path.GetDirectoryName(_settingsFilePath)
            ?? throw new InvalidOperationException("Settings path has no parent directory.");
        Directory.CreateDirectory(directory);

        var temporaryPath = _settingsFilePath + ".tmp";
        await using (var stream = File.Create(temporaryPath))
        {
            await JsonSerializer.SerializeAsync(
                stream,
                settings,
                SerializerOptions,
                cancellationToken);
        }

        File.Move(temporaryPath, _settingsFilePath, true);
    }

    private static void Migrate(AppSettings settings)
    {
        if (settings.SettingsSchemaVersion < 2)
        {
            settings.HidePromotions = true;
        }

        settings.SettingsSchemaVersion = AppSettings.CurrentSchemaVersion;
    }
}
