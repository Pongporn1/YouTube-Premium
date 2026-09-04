namespace MyTube.Models;

public sealed class DownloadRequestEventArgs : EventArgs
{
    public DownloadRequestEventArgs(string fileName)
    {
        FileName = fileName;
    }

    public string FileName { get; }

    public bool IsAllowed { get; set; }
}
