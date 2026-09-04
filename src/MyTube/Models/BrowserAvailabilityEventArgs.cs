namespace MyTube.Models;

public sealed class BrowserAvailabilityEventArgs : EventArgs
{
    public BrowserAvailabilityEventArgs(bool isAvailable)
    {
        IsAvailable = isAvailable;
    }

    public bool IsAvailable { get; }
}
