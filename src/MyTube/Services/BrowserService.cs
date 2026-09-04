using System.IO;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using MyTube.Models;
using MyTube.Utils;

namespace MyTube.Services;

public sealed class BrowserService : IDisposable
{
    public static readonly Uri HomeUri = new("https://www.youtube.com/");

    private readonly ProfileService _profileService;
    private readonly LoggingService _logger;
    private readonly NavigationPolicyService _navigationPolicy;
    private readonly CosmeticFilterService _cosmeticFilterService;
    private readonly IFilterEngine _filterEngine;
    private readonly AppSettings _settings;
    private WebView2? _webView;
    private bool _authenticationFlowActive;
    private bool _disposed;

    public BrowserService(
        ProfileService profileService,
        LoggingService logger,
        NavigationPolicyService navigationPolicy,
        CosmeticFilterService cosmeticFilterService,
        IFilterEngine filterEngine,
        AppSettings settings)
    {
        _profileService = profileService;
        _logger = logger;
        _navigationPolicy = navigationPolicy;
        _cosmeticFilterService = cosmeticFilterService;
        _filterEngine = filterEngine;
        _settings = settings;
    }

    public event EventHandler? NavigationStateChanged;

    public event EventHandler<ExternalNavigationEventArgs>? ExternalNavigationRequested;

    public event EventHandler<DownloadRequestEventArgs>? DownloadRequested;

    public event EventHandler<BrowserFailureEventArgs>? BrowserProcessFailed;

    public event EventHandler<BrowserAvailabilityEventArgs>? BrowserAvailabilityChanged;

    public bool CanGoBack => _webView?.CanGoBack == true;

    public bool CanGoForward => _webView?.CanGoForward == true;

    public async Task InitializeAsync(WebView2 webView)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        if (_webView is not null && !ReferenceEquals(_webView, webView))
        {
            DetachAndDisposeWebView();
        }

        _webView = webView;
        var environment = await CoreWebView2Environment.CreateAsync(
            userDataFolder: _profileService.UserDataDirectory);
        await webView.EnsureCoreWebView2Async(environment);

        try
        {
            await _filterEngine.InitializeAsync();
        }
        catch (Exception exception)
        {
            _logger.Error("Filter rules could not be initialized; network filtering will fail open.", exception);
        }
        ApplyBrowserSettings();
        webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        webView.CoreWebView2.HistoryChanged += OnHistoryChanged;
        webView.CoreWebView2.NavigationStarting += OnNavigationStarting;
        webView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
        webView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
        webView.CoreWebView2.AddWebResourceRequestedFilter(
            "*",
            CoreWebView2WebResourceContext.All);
        webView.CoreWebView2.WebResourceRequested += OnWebResourceRequested;
        webView.CoreWebView2.DownloadStarting += OnDownloadStarting;
        webView.CoreWebView2.ProcessFailed += OnProcessFailed;

        _logger.Info("WebView2 initialized with the dedicated MyTube profile.");
        if (_settings.OpenYouTubeOnStartup)
        {
            NavigateHome();
        }
    }

    public void GoBack()
    {
        if (CanGoBack)
        {
            _webView!.GoBack();
        }
    }

    public void GoForward()
    {
        if (CanGoForward)
        {
            _webView!.GoForward();
        }
    }

    public void Reload()
    {
        _webView?.Reload();
    }

    public void NavigateHome()
    {
        if (_webView?.CoreWebView2 is not null)
        {
            _webView.CoreWebView2.Navigate(HomeUri.AbsoluteUri);
        }
    }

    public async Task ApplySettingsAsync()
    {
        ApplyBrowserSettings();
        await ApplyCosmeticFiltersAsync();
    }

    public void OpenDevTools()
    {
#if DEBUG
        if (_settings.EnableDevTools && _webView?.CoreWebView2 is not null)
        {
            _webView.CoreWebView2.OpenDevToolsWindow();
        }
#endif
    }

    public async Task PrepareForShutdownAsync()
    {
        if (_webView?.CoreWebView2?.Profile is not { } profile)
        {
            return;
        }

        var kinds = (CoreWebView2BrowsingDataKinds)0;
        if (_settings.ClearCookiesOnExit || !_settings.RememberSession)
        {
            kinds |= CoreWebView2BrowsingDataKinds.Cookies;
        }

        if (_settings.ClearCacheOnExit)
        {
            kinds |= CoreWebView2BrowsingDataKinds.DiskCache;
        }

        if (kinds != 0)
        {
            await profile.ClearBrowsingDataAsync(kinds);
            _logger.Info("Selected browsing data was cleared on exit.");
        }
    }

    private void OnHistoryChanged(object? sender, object e)
    {
        NavigationStateChanged?.Invoke(this, EventArgs.Empty);
    }

    private void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        var currentUri = TryCreateAbsoluteUri(_webView?.Source?.AbsoluteUri);
        var targetUri = TryCreateAbsoluteUri(e.Uri);
        var decision = EvaluateNavigation(targetUri, currentUri);

        if (!decision.IsAllowed)
        {
            e.Cancel = true;
            _logger.Warning($"Blocked top-level navigation. Host={GetSafeHost(targetUri)} Reason={decision.Reason}");
            RaiseExternalNavigation(targetUri, e.Uri);
            return;
        }

        UpdateAuthenticationState(decision, targetUri);
        _logger.Info($"Allowed top-level navigation. Host={GetSafeHost(targetUri)}");
    }

    private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;

        var currentUri = TryCreateAbsoluteUri(_webView?.Source?.AbsoluteUri);
        var targetUri = TryCreateAbsoluteUri(e.Uri);
        var decision = EvaluateNavigation(targetUri, currentUri);

        if (!decision.IsAllowed)
        {
            _logger.Warning($"Blocked popup navigation. Host={GetSafeHost(targetUri)} Reason={decision.Reason}");
            RaiseExternalNavigation(targetUri, e.Uri);
            return;
        }

        UpdateAuthenticationState(decision, targetUri);
        _webView?.CoreWebView2.Navigate(targetUri!.AbsoluteUri);
    }

    private void UpdateAuthenticationState(NavigationDecision decision, Uri? targetUri)
    {
        if (decision.IsAuthenticationNavigation)
        {
            _authenticationFlowActive = true;
        }
        else if (targetUri is not null && DomainHelper.IsYouTubeHost(targetUri.IdnHost))
        {
            _authenticationFlowActive = false;
        }
    }

    private NavigationDecision EvaluateNavigation(Uri? targetUri, Uri? currentUri)
    {
        return _navigationPolicy.EvaluateTopLevelNavigation(
            targetUri,
            currentUri,
            _authenticationFlowActive);
    }

    private void ApplyBrowserSettings()
    {
        if (_webView?.CoreWebView2 is null)
        {
            return;
        }

        _webView.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
        _webView.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;

#if DEBUG
        _webView.CoreWebView2.Settings.AreDevToolsEnabled = _settings.EnableDevTools;
#else
        _webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
#endif
    }

    private void RaiseExternalNavigation(Uri? uri, string originalValue)
    {
        var externalUri = uri ?? TryCreateAbsoluteUri(originalValue);
        if (externalUri is not null)
        {
            ExternalNavigationRequested?.Invoke(this, new ExternalNavigationEventArgs(externalUri));
        }
    }

    private static Uri? TryCreateAbsoluteUri(string? value)
    {
        return Uri.TryCreate(value, UriKind.Absolute, out var uri) ? uri : null;
    }

    private static string GetSafeHost(Uri? uri)
    {
        return uri?.IdnHost ?? "invalid";
    }

    private async void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (e.IsSuccess)
        {
            _logger.Info("Navigation completed.");
            BrowserAvailabilityChanged?.Invoke(this, new BrowserAvailabilityEventArgs(true));
            await ApplyCosmeticFiltersAsync();
        }
        else
        {
            _logger.Warning($"Navigation failed with WebErrorStatus={e.WebErrorStatus}.");
            if (IsConnectivityFailure(e.WebErrorStatus))
            {
                BrowserAvailabilityChanged?.Invoke(this, new BrowserAvailabilityEventArgs(false));
            }
        }

        NavigationStateChanged?.Invoke(this, EventArgs.Empty);
    }

    private async Task ApplyCosmeticFiltersAsync()
    {
        if (_webView?.CoreWebView2 is null)
        {
            return;
        }

        try
        {
            await _cosmeticFilterService.ApplyAsync(
                _webView.CoreWebView2,
                _webView.Source,
                _settings);
        }
        catch (Exception exception)
        {
            _logger.Error("Cosmetic filtering failed open; page content was left unchanged.", exception);
        }
    }

    private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        if (!_settings.EnableContentFiltering || !_settings.BlockKnownTrackers)
        {
            return;
        }

        // Playback wins over filtering if a rule is too broad. WebSocket traffic is
        // not surfaced as a WebResourceRequested context by this WebView2 API.
        if (e.ResourceContext == CoreWebView2WebResourceContext.Media)
        {
            return;
        }

        try
        {
            var result = _filterEngine.Evaluate(
                e.Request.Uri,
                e.Request.Method,
                e.ResourceContext.ToString());
            if (!result.IsBlocked || _webView?.CoreWebView2 is null)
            {
                return;
            }

            e.Response = _webView.CoreWebView2.Environment.CreateWebResourceResponse(
                new MemoryStream(Array.Empty<byte>()),
                403,
                "Blocked by MyTube",
                "Content-Type: text/plain\r\nCache-Control: no-store");
            _logger.Info($"Blocked a filtered resource. Reason={result.Reason}");
        }
        catch (Exception exception)
        {
            _logger.Error("Network filtering failed open for one request.", exception);
        }
    }

    private void OnDownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        e.Cancel = true;
        e.Handled = true;

        var fileName = Path.GetFileName(e.ResultFilePath);
        if (string.IsNullOrWhiteSpace(fileName))
        {
            fileName = "download";
        }

        var request = new DownloadRequestEventArgs(fileName);
        DownloadRequested?.Invoke(this, request);
        if (!request.IsAllowed)
        {
            _logger.Info("A download request was canceled by policy or user choice.");
            return;
        }

        e.Cancel = false;
        e.Handled = false;
        _logger.Info("A user-approved download was handed to the WebView2 download UI.");
    }

    private void OnProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        var failureKind = e.ProcessFailedKind switch
        {
            CoreWebView2ProcessFailedKind.BrowserProcessExited => BrowserFailureKind.Browser,
            CoreWebView2ProcessFailedKind.RenderProcessExited
                or CoreWebView2ProcessFailedKind.RenderProcessUnresponsive
                or CoreWebView2ProcessFailedKind.FrameRenderProcessExited => BrowserFailureKind.Renderer,
            _ => BrowserFailureKind.Other,
        };

        _logger.Warning($"WebView2 process failure. Kind={e.ProcessFailedKind}");
        BrowserProcessFailed?.Invoke(this, new BrowserFailureEventArgs(failureKind));
    }

    private static bool IsConnectivityFailure(CoreWebView2WebErrorStatus status)
    {
        return status is CoreWebView2WebErrorStatus.Timeout
            or CoreWebView2WebErrorStatus.ConnectionReset
            or CoreWebView2WebErrorStatus.CannotConnect
            or CoreWebView2WebErrorStatus.HostNameNotResolved;
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        DetachAndDisposeWebView();
    }

    private void DetachAndDisposeWebView()
    {
        if (_webView?.CoreWebView2 is not null)
        {
            try
            {
                _webView.CoreWebView2.HistoryChanged -= OnHistoryChanged;
                _webView.CoreWebView2.NavigationStarting -= OnNavigationStarting;
                _webView.CoreWebView2.NavigationCompleted -= OnNavigationCompleted;
                _webView.CoreWebView2.NewWindowRequested -= OnNewWindowRequested;
                _webView.CoreWebView2.WebResourceRequested -= OnWebResourceRequested;
                _webView.CoreWebView2.DownloadStarting -= OnDownloadStarting;
                _webView.CoreWebView2.ProcessFailed -= OnProcessFailed;
            }
            catch (InvalidOperationException)
            {
                // A crashed browser process can make CoreWebView2 unavailable while detaching.
            }
        }

        _webView?.Dispose();
        _webView = null;
    }
}
