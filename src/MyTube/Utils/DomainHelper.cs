namespace MyTube.Utils;

public static class DomainHelper
{
    private static readonly HashSet<string> GoogleAuthenticationHosts = new(StringComparer.Ordinal)
    {
        "accounts.google.com",
        "gds.google.com",
    };

    public static bool IsYouTubeHost(string host)
    {
        return IsSameDomainOrSubdomain(host, "youtube.com");
    }

    public static bool IsGoogleAuthenticationHost(string host)
    {
        return GoogleAuthenticationHosts.Contains(NormalizeHost(host));
    }

    public static bool IsSameDomainOrSubdomain(string host, string expectedDomain)
    {
        var normalizedHost = NormalizeHost(host);
        var normalizedDomain = NormalizeHost(expectedDomain);

        return string.Equals(normalizedHost, normalizedDomain, StringComparison.Ordinal)
            || normalizedHost.EndsWith('.' + normalizedDomain, StringComparison.Ordinal);
    }

    private static string NormalizeHost(string host)
    {
        return host.Trim().TrimEnd('.').ToLowerInvariant();
    }
}
