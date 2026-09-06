using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using MyTube.Models;
using MyTube.Utils;

namespace MyTube.Services;

public sealed class BrowserService : IDisposable
{
    public static readonly Uri HomeUri = new("https://www.youtube.com/");
    public static readonly Uri MusicUri = new("https://music.youtube.com/");
    private static readonly CoreWebView2WebResourceContext[] FilteredResourceContexts =
    [
        CoreWebView2WebResourceContext.Script,
        CoreWebView2WebResourceContext.Image,
        CoreWebView2WebResourceContext.XmlHttpRequest,
        CoreWebView2WebResourceContext.Fetch,
        CoreWebView2WebResourceContext.Ping,
        CoreWebView2WebResourceContext.Other,
    ];

    private readonly ProfileService _profileService;
    private readonly LoggingService _logger;
    private readonly NavigationPolicyService _navigationPolicy;
    private readonly CosmeticFilterService _cosmeticFilterService;
    private readonly IFilterEngine _filterEngine;
    private readonly AppSettings _settings;
    private WebView2? _webView;
    private CoreWebView2Environment? _environment;
    private string? _documentStartFilterScriptId;
    private int _blockedResourceCount;
    private bool _authenticationFlowActive;
    private bool _disposed;

    private readonly string? _additionalBrowserArguments;

    public BrowserService(
        ProfileService profileService,
        LoggingService logger,
        NavigationPolicyService navigationPolicy,
        CosmeticFilterService cosmeticFilterService,
        IFilterEngine filterEngine,
        AppSettings settings,
        string? additionalBrowserArguments = null)
    {
        _profileService = profileService;
        _logger = logger;
        _navigationPolicy = navigationPolicy;
        _cosmeticFilterService = cosmeticFilterService;
        _filterEngine = filterEngine;
        _settings = settings;
        _additionalBrowserArguments = additionalBrowserArguments;
    }

    public event EventHandler? NavigationStateChanged;

    public event EventHandler<ExternalNavigationEventArgs>? ExternalNavigationRequested;

    public event EventHandler<DownloadRequestEventArgs>? DownloadRequested;

    public event EventHandler<BrowserFailureEventArgs>? BrowserProcessFailed;

    public event EventHandler<BrowserAvailabilityEventArgs>? BrowserAvailabilityChanged;

    public bool CanGoBack => _webView?.CanGoBack == true;

    public bool CanGoForward => _webView?.CanGoForward == true;

    public bool IsSuspended => _webView?.CoreWebView2?.IsSuspended ?? false;

    // Script execution that never throws: used by background helpers such as
    // the media-key bridge where a suspended or crashed renderer is expected.
    public async Task<string?> ExecuteScriptAsyncSafe(string script)
    {
        if (_webView?.CoreWebView2 is not { } coreWebView || _disposed)
        {
            return null;
        }

        try
        {
            return await coreWebView.ExecuteScriptAsync(script);
        }
        catch (Exception)
        {
            return null;
        }
    }

    public async Task InitializeAsync(WebView2 webView, Uri? startUri = null, CoreWebView2Environment? environmentOverride = null)
    {
        ObjectDisposedException.ThrowIf(_disposed, this);

        if (_webView is not null && !ReferenceEquals(_webView, webView))
        {
            DetachAndDisposeWebView();
        }

        _webView = webView;
        var environment = environmentOverride ?? await GetEnvironmentAsync();
        await webView.EnsureCoreWebView2Async(environment);
        webView.CoreWebView2.ProcessFailed += OnProcessFailed;

        try
        {
            await _filterEngine.InitializeAsync();
        }
        catch (Exception exception)
        {
            _logger.Error("Filter rules could not be initialized; network filtering will fail open.", exception);
        }
        ApplyBrowserSettings();
        await RefreshDocumentStartFilterAsync();
        webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
        webView.CoreWebView2.HistoryChanged += OnHistoryChanged;
        webView.CoreWebView2.NavigationStarting += OnNavigationStarting;
        webView.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
        webView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;
        foreach (var resourceContext in FilteredResourceContexts)
        {
            webView.CoreWebView2.AddWebResourceRequestedFilter(
                "*",
                resourceContext,
                CoreWebView2WebResourceRequestSourceKinds.All);
        }
        webView.CoreWebView2.WebResourceRequested += OnWebResourceRequested;
        webView.CoreWebView2.DownloadStarting += OnDownloadStarting;

        _logger.Info("WebView2 initialized with the dedicated MyTube profile.");
        if (startUri is not null)
        {
            _webView.CoreWebView2.Navigate(startUri.AbsoluteUri);
        }
        else if (_settings.OpenYouTubeOnStartup)
        {
            NavigateHome();
        }
    }

    // One environment is shared by every window in the process so the WebView2
    // browser process, cookies, and profile stay common (and light).
    public async Task<CoreWebView2Environment> GetEnvironmentAsync()
    {
        _environment ??= await CoreWebView2Environment.CreateAsync(
            userDataFolder: _profileService.UserDataDirectory,
            options: BuildEnvironmentOptions());
        return _environment;
    }

    private CoreWebView2EnvironmentOptions BuildEnvironmentOptions()
    {
        return new CoreWebView2EnvironmentOptions
        {
            // MyTube's own filter engine already blocks known trackers, so the
            // built-in tracking prevention would only duplicate per-request work.
            EnableTrackingPrevention = false,
            // Keep the process tree small: one renderer per site instead of
            // one per tab/frame tree. Playback stays on the GPU process.
            // The disk cache cap bounds YouTube's media cache growth.
            AdditionalBrowserArguments = _additionalBrowserArguments
                ?? "--process-per-site --renderer-process-limit=2 --disk-cache-size=268435456",
        };
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

    public void NavigateTo(Uri uri)
    {
        if (_webView?.CoreWebView2 is not null)
        {
            _webView.CoreWebView2.Navigate(uri.AbsoluteUri);
        }
    }

    public async Task ApplySettingsAsync()
    {
        ApplyBrowserSettings();
        await RefreshDocumentStartFilterAsync();
        await ApplyCosmeticFiltersAsync();
    }

    public async Task SetSuspendedAsync(bool suspended)
    {
        if (_webView?.CoreWebView2 is not { } coreWebView || _disposed)
        {
            return;
        }

        try
        {
            if (suspended)
            {
                if (!coreWebView.IsSuspended)
                {
                    if (await coreWebView.TrySuspendAsync())
                    {
                        TrimWorkingSet();
                    }
                }
            }
            else if (coreWebView.IsSuspended)
            {
                coreWebView.Resume();
            }
        }
        catch (Exception exception)
        {
            _logger.Error("WebView2 suspend/resume failed; continuing unsuspended.", exception);
        }
    }

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetProcessWorkingSetSize(IntPtr process, IntPtr minimumWorkingSetSize, IntPtr maximumWorkingSetSize);

    // After suspension nothing touches the host's pages for a while, so handing
    // the working set back to Windows is free; the pages fault back in softly
    // on resume.
    private static void TrimWorkingSet()
    {
        try
        {
            SetProcessWorkingSetSize(System.Diagnostics.Process.GetCurrentProcess().Handle, new IntPtr(-1), new IntPtr(-1));
        }
        catch (Exception)
        {
            // Trimming is cosmetic; failing to trim changes nothing functional.
        }
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
        Interlocked.Exchange(ref _blockedResourceCount, 0);
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

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        if (e.IsSuccess)
        {
            var blockedResources = Interlocked.Exchange(ref _blockedResourceCount, 0);
            _logger.Info($"Navigation completed. BlockedResources={blockedResources}");
            BrowserAvailabilityChanged?.Invoke(this, new BrowserAvailabilityEventArgs(true));
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

    private async Task RefreshDocumentStartFilterAsync()
    {
        if (_webView?.CoreWebView2 is not { } coreWebView)
        {
            return;
        }

        if (_documentStartFilterScriptId is not null)
        {
            coreWebView.RemoveScriptToExecuteOnDocumentCreated(_documentStartFilterScriptId);
        }

        _documentStartFilterScriptId = await _cosmeticFilterService
            .RegisterForDocumentCreationAsync(coreWebView, _settings);
    }

    private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        if (!_settings.EnableContentFiltering || !_settings.BlockKnownTrackers)
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
            Interlocked.Increment(ref _blockedResourceCount);
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
        var failureKind = ClassifyProcessFailure(e.ProcessFailedKind);
        _logger.Warning(
            $"WebView2 process failure. Kind={e.ProcessFailedKind} Reason={e.Reason} "
            + $"ExitCode={e.ExitCode} Description={e.ProcessDescription}");
        BrowserProcessFailed?.Invoke(this, new BrowserFailureEventArgs(failureKind));
    }

    internal static BrowserFailureKind ClassifyProcessFailure(CoreWebView2ProcessFailedKind processFailedKind)
    {
        return processFailedKind switch
        {
            CoreWebView2ProcessFailedKind.BrowserProcessExited => BrowserFailureKind.Browser,
            CoreWebView2ProcessFailedKind.RenderProcessExited
                => BrowserFailureKind.Renderer,
            CoreWebView2ProcessFailedKind.RenderProcessUnresponsive
                => BrowserFailureKind.RendererUnresponsive,
            CoreWebView2ProcessFailedKind.FrameRenderProcessExited
                or CoreWebView2ProcessFailedKind.UtilityProcessExited
                or CoreWebView2ProcessFailedKind.SandboxHelperProcessExited
                or CoreWebView2ProcessFailedKind.GpuProcessExited
                or CoreWebView2ProcessFailedKind.PpapiPluginProcessExited
                or CoreWebView2ProcessFailedKind.PpapiBrokerProcessExited
                => BrowserFailureKind.Auxiliary,
            _ => BrowserFailureKind.Other,
        };
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
                if (_documentStartFilterScriptId is not null)
                {
                    _webView.CoreWebView2.RemoveScriptToExecuteOnDocumentCreated(
                        _documentStartFilterScriptId);
                    _documentStartFilterScriptId = null;
                }

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
