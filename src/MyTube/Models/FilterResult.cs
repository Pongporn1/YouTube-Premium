namespace MyTube.Models;

public sealed record FilterResult(
    bool IsBlocked,
    string? MatchedRule,
    string? Reason)
{
    public static FilterResult Allowed() => new(false, null, null);

    public static FilterResult Blocked(string matchedRule, string reason) =>
        new(true, matchedRule, reason);
}
