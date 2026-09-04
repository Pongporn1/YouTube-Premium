using System.IO;

namespace MyTube.Services;

public sealed class ProfileService
{
    public ProfileService()
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var roamingAppData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);

        LocalDataDirectory = Path.Combine(localAppData, "MyTube");
        UserDataDirectory = Path.Combine(LocalDataDirectory, "UserData");
        LogDirectory = Path.Combine(LocalDataDirectory, "Logs");
        SettingsDirectory = Path.Combine(roamingAppData, "MyTube");
        SettingsFilePath = Path.Combine(SettingsDirectory, "settings.json");

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
