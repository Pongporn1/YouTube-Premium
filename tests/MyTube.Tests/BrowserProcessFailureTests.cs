using Microsoft.Web.WebView2.Core;
using MyTube.Models;
using MyTube.Services;

namespace MyTube.Tests;

[TestClass]
public sealed class BrowserProcessFailureTests
{
    [TestMethod]
    [DataRow(CoreWebView2ProcessFailedKind.GpuProcessExited)]
    [DataRow(CoreWebView2ProcessFailedKind.UtilityProcessExited)]
    [DataRow(CoreWebView2ProcessFailedKind.FrameRenderProcessExited)]
    public void RecoverableChildProcessFailuresAreAuxiliary(
        CoreWebView2ProcessFailedKind processFailedKind)
    {
        var result = BrowserService.ClassifyProcessFailure(processFailedKind);

        Assert.AreEqual(BrowserFailureKind.Auxiliary, result);
    }

    [TestMethod]
    public void BrowserExitRequiresBrowserRecovery()
    {
        var result = BrowserService.ClassifyProcessFailure(
            CoreWebView2ProcessFailedKind.BrowserProcessExited);

        Assert.AreEqual(BrowserFailureKind.Browser, result);
    }

    [TestMethod]
    public void RendererHangDoesNotPretendTheRendererExited()
    {
        var result = BrowserService.ClassifyProcessFailure(
            CoreWebView2ProcessFailedKind.RenderProcessUnresponsive);

        Assert.AreEqual(BrowserFailureKind.RendererUnresponsive, result);
    }
}
