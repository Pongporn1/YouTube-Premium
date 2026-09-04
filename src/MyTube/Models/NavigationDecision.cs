namespace MyTube.Models;

public sealed record NavigationDecision(
    bool IsAllowed,
    bool IsAuthenticationNavigation,
    string Reason)
{
    public static NavigationDecision Allow(string reason) => new(true, false, reason);

    public static NavigationDecision AllowAuthentication(string reason) => new(true, true, reason);

    public static NavigationDecision Block(string reason) => new(false, false, reason);
}
