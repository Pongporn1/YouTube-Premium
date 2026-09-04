namespace MyTube.Models;

public sealed class ExternalNavigationEventArgs : EventArgs
{
    public ExternalNavigationEventArgs(Uri uri)
    {
        Uri = uri;
    }

    public Uri Uri { get; }
}
