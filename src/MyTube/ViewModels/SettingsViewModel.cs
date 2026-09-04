using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using MyTube.Models;
using MyTube.Utils;

namespace MyTube.ViewModels;

public sealed class SettingsViewModel : INotifyPropertyChanged
{
    private AppSettings _draft;

    public SettingsViewModel(AppSettings currentSettings)
    {
        _draft = currentSettings.Clone();
        InitiallyClearedCookiesOnExit = currentSettings.ClearCookiesOnExit;
        ResetDefaultsCommand = new RelayCommand(ResetDefaults);
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public AppSettings Draft
    {
        get => _draft;
        private set
        {
            _draft = value;
            OnPropertyChanged();
        }
    }

    public bool InitiallyClearedCookiesOnExit { get; }

    public ICommand ResetDefaultsCommand { get; }

    public void ApplyTo(AppSettings target)
    {
        target.CopyFrom(Draft);
    }

    private void ResetDefaults()
    {
        Draft = new AppSettings();
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
