namespace MyTube.Models;

public enum FilterRuleAction
{
    Allow,
    Block,
}

public enum FilterRuleMatchType
{
    Domain,
    ExactUrl,
    UrlContains,
    Wildcard,
}

public sealed record FilterRule(
    FilterRuleAction Action,
    FilterRuleMatchType MatchType,
    string Pattern,
    IReadOnlySet<string> ResourceTypes,
    string OriginalText);
