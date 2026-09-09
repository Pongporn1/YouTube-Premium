using System.Diagnostics;
using System.Windows;
using MyTubeMusic.Views;

namespace MyTubeMusic;

public partial class App : Application
{
    private EventWaitHandle? _activation;
    private RegisteredWaitHandle? _activationWait;

    protected override void OnStartup(StartupEventArgs e)
    {
        // One player per Windows session, including launches from MyTube.
        _activation = new EventWaitHandle(false, EventResetMode.AutoReset,
            @"Local\MyTubeMusic.Activate", out var firstInstance);
        if (!firstInstance)
        {
            _activation.Set();
            Shutdown();
            return;
        }
        // Background music for gaming runs below normal priority: the FPS game
        // always wins the CPU and this player yields first under load.
        Process.GetCurrentProcess().PriorityClass = ProcessPriorityClass.BelowNormal;
        base.OnStartup(e);
        var window = new MainWindow();
        MainWindow = window;
        window.Show();
        _activationWait = ThreadPool.RegisterWaitForSingleObject(_activation,
            (_, _) => Dispatcher.BeginInvoke(new Action(() =>
            {
                if (window.WindowState == WindowState.Minimized)
                    window.WindowState = WindowState.Normal;
                window.Show();
                window.Activate();
            })), null, Timeout.Infinite, false);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _activationWait?.Unregister(null);
        _activation?.Dispose();
        base.OnExit(e);
    }
}
