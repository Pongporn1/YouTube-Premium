using System.Diagnostics;
using System.Windows;
using MyTubeMusic.Views;

namespace MyTubeMusic;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        // Background music for gaming runs below normal priority: the FPS game
        // always wins the CPU and this player yields first under load.
        Process.GetCurrentProcess().PriorityClass = ProcessPriorityClass.BelowNormal;
        base.OnStartup(e);
        var window = new MainWindow();
        MainWindow = window;
        window.Show();
    }
}
