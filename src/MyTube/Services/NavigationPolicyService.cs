using MyTube.Models;
using MyTube.Utils;

namespace MyTube.Services;

public sealed class NavigationPolicyService
{
    public NavigationDecision EvaluateTopLevelNavigation(
        Uri? targetUri,
        Uri? currentUri,
        bool authenticationFlowActive)
    {
        if (targetUri is null || !targetUri.IsAbsoluteUri)
        {
            return NavigationDecision.Block("The target is not a valid absolute URL.");
        }

        if (!string.Equals(targetUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase))
        {
            return NavigationDecision.Block("Only HTTPS top-level navigation is allowed.");
        }

        if (DomainHelper.IsYouTubeHost(targetUri.IdnHost))
        {
            return NavigationDecision.Allow("YouTube navigation.");
        }

        if (!DomainHelper.IsGoogleAuthenticationHost(targetUri.IdnHost))
        {
            return NavigationDecision.Block("The destination is outside YouTube.");
        }

        var startedFromYouTube = currentUri is not null
            && DomainHelper.IsYouTubeHost(currentUri.IdnHost);
        var continuedOnAccounts = currentUri is not null
            && DomainHelper.IsGoogleAuthenticationHost(currentUri.IdnHost);

        return authenticationFlowActive || startedFromYouTube || continuedOnAccounts
            ? NavigationDecision.AllowAuthentication("Google authentication flow.")
            : NavigationDecision.Block("Google Accounts is allowed only during a YouTube sign-in flow.");
    }
}
