using System.Text.RegularExpressions;
using MyTube.Models;

namespace MyTube.Services;

public sealed class FilterEngine : IFilterEngine
{
    private static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(50);

    private readonly IFilterListProvider _filterListProvider;
    private readonly LoggingService _logger;
    private CompiledRuleSet _compiledRules = CompiledRuleSet.Empty;

    public FilterEngine(IFilterListProvider filterListProvider, LoggingService logger)
    {
        _filterListProvider = filterListProvider;
        _logger = logger;
    }

    public int RuleCount => _compiledRules.RuleCount;

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        var lines = await _filterListProvider.GetRulesAsync(cancellationToken);
        var compiled = new CompiledRuleSet();
        var invalidRuleCount = 0;

        foreach (var line in lines)
        {
            if (string.IsNullOrWhiteSpace(line)
                || line.TrimStart().StartsWith('!')
                || line.TrimStart().StartsWith('#'))
            {
                continue;
            }

            if (!TryParseRule(line, out var rule))
            {
                invalidRuleCount++;
                continue;
            }

            compiled.Add(rule!);
        }

        _compiledRules = compiled;
        _logger.Info($"Filter rules loaded. Count={compiled.RuleCount} Invalid={invalidRuleCount}");
    }

    public FilterResult Evaluate(string url, string method, string resourceContext)
    {
        _ = method;
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            return FilterResult.Allowed();
        }

        var rules = _compiledRules;
        try
        {
            var allowRule = rules.FindMatch(
                FilterRuleAction.Allow,
                uri,
                url,
                resourceContext);
            if (allowRule is not null)
            {
                return FilterResult.Allowed();
            }

            var blockRule = rules.FindMatch(
                FilterRuleAction.Block,
                uri,
                url,
                resourceContext);
            return blockRule is null
                ? FilterResult.Allowed()
                : FilterResult.Blocked(blockRule.OriginalText, $"Matched {blockRule.MatchType} rule.");
        }
        catch (RegexMatchTimeoutException)
        {
            return FilterResult.Allowed();
        }
    }

    internal static bool TryParseRule(string text, out FilterRule? rule)
    {
        rule = null;
        var trimmed = text.Trim();

        var isAdblockAllow = trimmed.StartsWith("@@||", StringComparison.Ordinal)
            && trimmed.EndsWith('^');
        var isAdblockBlock = trimmed.StartsWith("||", StringComparison.Ordinal)
            && trimmed.EndsWith('^');
        if (isAdblockAllow || isAdblockBlock)
        {
            var prefixLength = isAdblockAllow ? 4 : 2;
            var domain = trimmed[prefixLength..^1].Trim().TrimEnd('.').ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(domain) || domain.Contains('/'))
            {
                return false;
            }

            rule = new FilterRule(
                isAdblockAllow ? FilterRuleAction.Allow : FilterRuleAction.Block,
                FilterRuleMatchType.Domain,
                domain,
                new HashSet<string>(StringComparer.OrdinalIgnoreCase),
                trimmed);
            return true;
        }

        var parts = trimmed.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 3
            || !Enum.TryParse<FilterRuleAction>(parts[0], true, out var action))
        {
            return false;
        }

        var matchType = parts[1].ToUpperInvariant() switch
        {
            "DOMAIN" => FilterRuleMatchType.Domain,
            "URL" => FilterRuleMatchType.ExactUrl,
            "URL_CONTAINS" => FilterRuleMatchType.UrlContains,
            "WILDCARD" => FilterRuleMatchType.Wildcard,
            _ => (FilterRuleMatchType?)null,
        };
        if (matchType is null)
        {
            return false;
        }

        var pattern = matchType == FilterRuleMatchType.Domain
            ? parts[2].TrimEnd('.').ToLowerInvariant()
            : parts[2];
        if (string.IsNullOrWhiteSpace(pattern))
        {
            return false;
        }

        var resourceTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (parts.Length > 3)
        {
            if (parts.Length != 5
                || !string.Equals(parts[3], "RESOURCE", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            foreach (var resourceType in parts[4].Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                resourceTypes.Add(resourceType.Trim());
            }
        }

        rule = new FilterRule(action, matchType.Value, pattern, resourceTypes, trimmed);
        return true;
    }

    private sealed class CompiledRuleSet
    {
        public static CompiledRuleSet Empty { get; } = new();

        private readonly RuleIndex _allowRules = new();
        private readonly RuleIndex _blockRules = new();

        public int RuleCount { get; private set; }

        public void Add(FilterRule rule)
        {
            var index = rule.Action == FilterRuleAction.Allow ? _allowRules : _blockRules;
            index.Add(new CompiledRule(rule));
            RuleCount++;
        }

        public FilterRule? FindMatch(
            FilterRuleAction action,
            Uri uri,
            string originalUrl,
            string resourceContext)
        {
            var index = action == FilterRuleAction.Allow ? _allowRules : _blockRules;
            return index.FindMatch(uri, originalUrl, resourceContext)?.Rule;
        }
    }

    private sealed class RuleIndex
    {
        private readonly Dictionary<string, List<CompiledRule>> _domains =
            new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, List<CompiledRule>> _exactUrls =
            new(StringComparer.Ordinal);
        private readonly List<CompiledRule> _containsRules = [];
        private readonly List<CompiledRule> _wildcardRules = [];

        public void Add(CompiledRule rule)
        {
            switch (rule.Rule.MatchType)
            {
                case FilterRuleMatchType.Domain:
                    AddToLookup(_domains, rule.Rule.Pattern, rule);
                    break;
                case FilterRuleMatchType.ExactUrl:
                    AddToLookup(_exactUrls, rule.Rule.Pattern, rule);
                    break;
                case FilterRuleMatchType.UrlContains:
                    _containsRules.Add(rule);
                    break;
                case FilterRuleMatchType.Wildcard:
                    _wildcardRules.Add(rule);
                    break;
            }
        }

        public CompiledRule? FindMatch(Uri uri, string originalUrl, string resourceContext)
        {
            if (_exactUrls.TryGetValue(originalUrl, out var exactRules))
            {
                var exactMatch = exactRules.FirstOrDefault(rule => rule.AppliesTo(resourceContext));
                if (exactMatch is not null)
                {
                    return exactMatch;
                }
            }

            foreach (var domain in EnumerateDomainCandidates(uri.IdnHost))
            {
                if (!_domains.TryGetValue(domain, out var domainRules))
                {
                    continue;
                }

                var domainMatch = domainRules.FirstOrDefault(rule => rule.AppliesTo(resourceContext));
                if (domainMatch is not null)
                {
                    return domainMatch;
                }
            }

            var containsMatch = _containsRules.FirstOrDefault(
                rule => rule.AppliesTo(resourceContext)
                    && originalUrl.Contains(rule.Rule.Pattern, StringComparison.OrdinalIgnoreCase));
            if (containsMatch is not null)
            {
                return containsMatch;
            }

            return _wildcardRules.FirstOrDefault(
                rule => rule.AppliesTo(resourceContext)
                    && rule.WildcardRegex!.IsMatch(originalUrl));
        }

        private static void AddToLookup(
            Dictionary<string, List<CompiledRule>> lookup,
            string key,
            CompiledRule rule)
        {
            if (!lookup.TryGetValue(key, out var rules))
            {
                rules = [];
                lookup.Add(key, rules);
            }

            rules.Add(rule);
        }

        private static IEnumerable<string> EnumerateDomainCandidates(string host)
        {
            var normalized = host.TrimEnd('.').ToLowerInvariant();
            yield return normalized;

            var index = normalized.IndexOf('.');
            while (index >= 0 && index < normalized.Length - 1)
            {
                normalized = normalized[(index + 1)..];
                yield return normalized;
                index = normalized.IndexOf('.');
            }
        }
    }

    private sealed class CompiledRule
    {
        public CompiledRule(FilterRule rule)
        {
            Rule = rule;
            if (rule.MatchType == FilterRuleMatchType.Wildcard)
            {
                var regexPattern = '^' + Regex.Escape(rule.Pattern).Replace("\\*", ".*") + '$';
                WildcardRegex = new Regex(
                    regexPattern,
                    RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase,
                    RegexTimeout);
            }
        }

        public FilterRule Rule { get; }

        public Regex? WildcardRegex { get; }

        public bool AppliesTo(string resourceContext)
        {
            return Rule.ResourceTypes.Count == 0 || Rule.ResourceTypes.Contains(resourceContext);
        }
    }
}
