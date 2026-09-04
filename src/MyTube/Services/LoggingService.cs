using System.IO;

namespace MyTube.Services;

public sealed class LoggingService
{
    private readonly object _syncRoot = new();
    private readonly string _logFilePath;

    public LoggingService(string logDirectory)
    {
        Directory.CreateDirectory(logDirectory);
        _logFilePath = Path.Combine(logDirectory, "mytube.log");
    }

    public void Info(string message) => Write("INFO", message);

    public void Warning(string message) => Write("WARN", message);

    public void Error(string message, Exception? exception = null)
    {
        var safeException = exception is null
            ? string.Empty
            : $" ExceptionType={exception.GetType().Name}.";
        Write("ERROR", message + safeException);
    }

    private void Write(string level, string message)
    {
        var cleanMessage = message.Replace('\r', ' ').Replace('\n', ' ');
        var line = $"{DateTimeOffset.Now:O} [{level}] {cleanMessage}{Environment.NewLine}";

        try
        {
            lock (_syncRoot)
            {
                File.AppendAllText(_logFilePath, line);
            }
        }
        catch
        {
            // Logging must never crash the browser.
        }
    }
}
