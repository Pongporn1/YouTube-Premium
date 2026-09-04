namespace MyTube.Models;

public enum BrowserFailureKind
{
    Renderer,
    Browser,
    Other,
}

public sealed class BrowserFailureEventArgs : EventArgs
{
    public BrowserFailureEventArgs(BrowserFailureKind kind)
    {
        Kind = kind;
    }

    public BrowserFailureKind Kind { get; }
}
