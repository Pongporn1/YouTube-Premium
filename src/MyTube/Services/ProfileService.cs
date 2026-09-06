using System.IO;

namespace MyTube.Services;

public sealed class ProfileService
{
    public ProfileService(string? appNameOverride = null)
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var roamingAppData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var localRoot = Path.Combine(localAppData, appNameOverride ?? "MyTube");
        var roamingRoot = Path.Combine(roamingAppData, appNameOverride ?? "MyTube");

        LocalDataDirectory = localRoot;
        UserDataDirectory = Path.Combine(localRoot, "UserData");
        LogDirectory = Path.Combine(localRoot, "Logs");
        SettingsDirectory = roamingRoot;
        SettingsFilePath = Path.Combine(roamingRoot, "settings.json");

        Directory.CreateDirectory(UserDataDirectory);
        Directory.CreateDirectory(LogDirectory);
        Directory.CreateDirectory(SettingsDirectory);
    }

    public string LocalDataDirectory { get; }

    public string UserDataDirectory { get; }

    public string LogDirectory { get; }

    public string SettingsDirectory { get; }

    public string SettingsFilePath { get; }
}
