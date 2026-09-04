using System.IO;
using System.Text;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using MyTube.Models;
using MyTube.Utils;

namespace MyTube.Services;

public sealed class CosmeticFilterService
{
    private const string CssPlaceholder = "__MYTUBE_CSS_JSON__";
    private const string PlayerAdBlockingPlaceholder = "__MYTUBE_BLOCK_PLAYER_ADS__";

    private readonly LoggingService _logger;
    private readonly string _baseCss;
    private readonly string _scriptTemplate;

    public CosmeticFilterService(LoggingService logger)
    {
        _logger = logger;
        _baseCss = LoadResource(
            Path.Combine("Resources", "Styles", "cosmetic-filter.css"),
            "/* MyTube cosmetic filter */");
        _scriptTemplate = LoadResource(
            Path.Combine("Resources", "Scripts", "cosmetic-filter.js"),
            "(() => { const id = 'mytube-cosmetic-filter'; let style = document.getElementById(id); if (!style) { style = document.createElement('style'); style.id = id; document.documentElement.appendChild(style); } style.textContent = __MYTUBE_CSS_JSON__; })();");
    }

    public async Task ApplyAsync(CoreWebView2 webView, Uri? source, AppSettings settings)
    {
        if (source is null || !DomainHelper.IsYouTubeHost(source.IdnHost))
        {
            return;
        }

        await webView.ExecuteScriptAsync(CreateScript(settings));
    }

    public Task<string> RegisterForDocumentCreationAsync(CoreWebView2 webView, AppSettings settings)
    {
        return webView.AddScriptToExecuteOnDocumentCreatedAsync(CreateScript(settings));
    }

    internal string CreateScript(AppSettings settings)
    {
        return _scriptTemplate
            .Replace(
                CssPlaceholder,
                JsonSerializer.Serialize(BuildCss(settings)),
                StringComparison.Ordinal)
            .Replace(
                PlayerAdBlockingPlaceholder,
                JsonSerializer.Serialize(true),
                StringComparison.Ordinal);
    }

    private string BuildCss(AppSettings settings)
    {
        var css = new StringBuilder(_baseCss);
        AddHideRule(css, settings.HideShorts || settings.FocusMode, YouTubeSelectors.Shorts);
        AddHideRule(css, settings.HideHomeFeed || settings.FocusMode, YouTubeSelectors.HomeFeed);
        AddHideRule(css, settings.HideRecommendations || settings.FocusMode, YouTubeSelectors.Recommendations);
        AddHideRule(css, settings.HideComments, YouTubeSelectors.Comments);
        AddHideRule(css, settings.HideMerch || settings.FocusMode, YouTubeSelectors.Merch);
        AddHideRule(css, settings.HidePromotions || settings.FocusMode, YouTubeSelectors.Promotions);
        AddHideRule(css, true, YouTubeSelectors.PlayerAds);
        AddHideRule(css, settings.HidePopups, YouTubeSelectors.Popups);
        return css.ToString();
    }

    private static void AddHideRule(StringBuilder css, bool enabled, IEnumerable<string> selectors)
    {
        if (!enabled)
        {
            return;
        }

        css.AppendLine();
        css.AppendJoin(",\n", selectors);
        css.AppendLine(" { display: none !important; }");
    }

    private string LoadResource(string relativePath, string fallback)
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, relativePath);
            return File.ReadAllText(path);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            _logger.Error($"Cosmetic filter resource could not be loaded. Resource={relativePath}", exception);
            return fallback;
        }
    }
}
