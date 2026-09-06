namespace MyTube.Models;

public enum BrowserFailureKind
{
    Renderer,
    RendererUnresponsive,
    Browser,
    Auxiliary,
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
