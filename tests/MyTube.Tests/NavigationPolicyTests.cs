using MyTube.Services;

namespace MyTube.Tests;

[TestClass]
public sealed class NavigationPolicyTests
{
    private readonly NavigationPolicyService _policy = new();

    [TestMethod]
    [DataRow("https://youtube.com/")]
    [DataRow("https://www.youtube.com/watch?v=test")]
    [DataRow("https://m.youtube.com/")]
    [DataRow("https://studio.youtube.com/")]
    public void YouTubeHostsAreAllowed(string url)
    {
        var result = _policy.EvaluateTopLevelNavigation(new Uri(url), null, false);

        Assert.IsTrue(result.IsAllowed);
    }

    [TestMethod]
    [DataRow("https://facebook.com/")]
    [DataRow("https://example.com/")]
    [DataRow("https://youtube.com.example.com/")]
    [DataRow("https://youtube-example.com/")]
    [DataRow("https://attacker.com/?youtube.com")]
    [DataRow("https://gds.google.com.attacker.test/")]
    [DataRow("http://www.youtube.com/")]
    public void ExternalAndSpoofedHostsAreBlocked(string url)
    {
        var result = _policy.EvaluateTopLevelNavigation(new Uri(url), null, false);

        Assert.IsFalse(result.IsAllowed);
    }

    [TestMethod]
    public void GoogleAccountsIsAllowedWhenFlowStartsFromYouTube()
    {
        var result = _policy.EvaluateTopLevelNavigation(
            new Uri("https://accounts.google.com/ServiceLogin"),
            new Uri("https://www.youtube.com/"),
            false);

        Assert.IsTrue(result.IsAllowed);
        Assert.IsTrue(result.IsAuthenticationNavigation);
    }

    [TestMethod]
    [DataRow("https://accounts.google.com/ServiceLogin")]
    [DataRow("https://gds.google.com/web/landing")]
    public void GoogleAuthenticationHostsAreBlockedOutsideAuthenticationFlow(string url)
    {
        var result = _policy.EvaluateTopLevelNavigation(
            new Uri(url),
            null,
            false);

        Assert.IsFalse(result.IsAllowed);
    }

    [TestMethod]
    public void GoogleDeviceServicesLandingIsAllowedOnlyFromYouTubeSignIn()
    {
        var result = _policy.EvaluateTopLevelNavigation(
            new Uri("https://gds.google.com/web/landing"),
            new Uri("https://accounts.youtube.com/accounts/SetSID"),
            false);

        Assert.IsTrue(result.IsAllowed);
        Assert.IsTrue(result.IsAuthenticationNavigation);
    }

    [TestMethod]
    public void AccountsGoogleCanContinueFromGoogleDeviceServicesLanding()
    {
        var result = _policy.EvaluateTopLevelNavigation(
            new Uri("https://accounts.google.com/ServiceLogin"),
            new Uri("https://gds.google.com/web/landing"),
            true);

        Assert.IsTrue(result.IsAllowed);
        Assert.IsTrue(result.IsAuthenticationNavigation);
    }
}
