using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows.Input;
using Microsoft.Web.WebView2.Wpf;
using MyTube.Services;
using MyTube.Utils;

namespace MyTube.ViewModels;

public sealed class MainViewModel : INotifyPropertyChanged
{
    private readonly BrowserService _browserService;
    private bool _canGoBack;
    private bool _canGoForward;

    public MainViewModel(BrowserService browserService)
    {
        _browserService = browserService;
        _browserService.NavigationStateChanged += OnNavigationStateChanged;

        BackCommand = new RelayCommand(_browserService.GoBack, () => CanGoBack);
        ForwardCommand = new RelayCommand(_browserService.GoForward, () => CanGoForward);
        ReloadCommand = new RelayCommand(_browserService.Reload);
        HomeCommand = new RelayCommand(_browserService.NavigateHome);
        OpenSettingsCommand = new RelayCommand(() => SettingsRequested?.Invoke(this, EventArgs.Empty));
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public event EventHandler? SettingsRequested;

    public ICommand BackCommand { get; }

    public ICommand ForwardCommand { get; }

    public ICommand ReloadCommand { get; }

    public ICommand HomeCommand { get; }

    public ICommand OpenSettingsCommand { get; }

    public bool CanGoBack
    {
        get => _canGoBack;
        private set => SetField(ref _canGoBack, value);
    }

    public bool CanGoForward
    {
        get => _canGoForward;
        private set => SetField(ref _canGoForward, value);
    }

    public async Task InitializeAsync(WebView2 webView)
    {
        await _browserService.InitializeAsync(webView);
        RefreshNavigationState();
    }

    private void OnNavigationStateChanged(object? sender, EventArgs e)
    {
        RefreshNavigationState();
    }

    private void RefreshNavigationState()
    {
        CanGoBack = _browserService.CanGoBack;
        CanGoForward = _browserService.CanGoForward;
        (BackCommand as RelayCommand)?.RaiseCanExecuteChanged();
        (ForwardCommand as RelayCommand)?.RaiseCanExecuteChanged();
    }

    private void SetField(ref bool field, bool value, [CallerMemberName] string? propertyName = null)
    {
        if (field == value)
        {
            return;
        }

        field = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
