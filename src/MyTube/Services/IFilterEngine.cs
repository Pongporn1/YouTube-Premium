using MyTube.Models;

namespace MyTube.Services;

public interface IFilterEngine
{
    int RuleCount { get; }

    Task InitializeAsync(CancellationToken cancellationToken = default);

    FilterResult Evaluate(string url, string method, string resourceContext);
}
