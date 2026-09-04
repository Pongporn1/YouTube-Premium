using System.IO;

namespace MyTube.Services;

public sealed class LocalFilterListProvider : IFilterListProvider
{
    private readonly string _filterFilePath;

    public LocalFilterListProvider(string? filterFilePath = null)
    {
        _filterFilePath = filterFilePath
            ?? Path.Combine(AppContext.BaseDirectory, "Resources", "Filters", "default-filters.txt");
    }

    public async Task<IReadOnlyList<string>> GetRulesAsync(CancellationToken cancellationToken = default)
    {
        return await File.ReadAllLinesAsync(_filterFilePath, cancellationToken);
    }
}
