namespace MyTube.Services;

public interface IFilterListProvider
{
    Task<IReadOnlyList<string>> GetRulesAsync(CancellationToken cancellationToken = default);
}
