namespace MyTube.Services;

public static class YouTubeSelectors
{
    public static readonly string[] Shorts =
    [
        "ytd-reel-shelf-renderer",
        "ytd-rich-shelf-renderer[is-shorts]",
        "ytd-guide-entry-renderer a[href='/shorts']",
        "ytd-mini-guide-entry-renderer a[href='/shorts']",
        "ytd-video-renderer a[href^='/shorts/']",
        "ytd-rich-item-renderer:has(a[href^='/shorts/'])",
    ];

    public static readonly string[] HomeFeed =
    [
        "ytd-browse[page-subtype='home'] #primary",
        "ytd-browse[page-subtype='home'] ytd-rich-grid-renderer",
    ];

    public static readonly string[] Recommendations =
    [
        "ytd-watch-flexy #secondary",
        "ytd-watch-next-secondary-results-renderer",
    ];

    public static readonly string[] Comments =
    [
        "ytd-watch-flexy ytd-comments#comments",
        "ytd-comments#comments",
    ];

    public static readonly string[] Merch =
    [
        "ytd-merch-shelf-renderer",
        "ytd-product-list-renderer",
        "ytd-shopping-shelf-renderer",
    ];

    public static readonly string[] Promotions =
    [
        "#masthead-ad",
        "ytd-video-masthead-ad-v3-renderer",
        "ytd-brand-video-shelf-renderer",
        "ytd-inline-survey-renderer",
        "ytd-rich-section-renderer:has(#masthead-ad)",
        "ytd-rich-section-renderer:has(ytd-brand-video-shelf-renderer)",
        "ytd-rich-section-renderer:has(ytd-inline-survey-renderer)",
        "ytd-promoted-sparkles-web-renderer",
        "ytd-promoted-sparkles-text-search-renderer",
        "ytd-promoted-video-renderer",
        "ytd-compact-promoted-video-renderer",
        "ytd-display-ad-renderer",
        "ytd-search-pyv-renderer",
        "ytd-in-feed-ad-layout-renderer",
        "ytd-ad-slot-renderer",
        "yt-ad-slot-renderer",
        "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
        "ytd-rich-item-renderer:has(ytd-in-feed-ad-layout-renderer)",
        "ytd-rich-item-renderer:has(a[href*='/pagead/aclk'])",
        "ytd-rich-item-renderer:has(a[href*='googleadservices.com'])",
        "yt-lockup-view-model:has(a[href*='/pagead/aclk'])",
        "yt-lockup-view-model:has(a[href*='googleadservices.com'])",
    ];

    public static readonly string[] PlayerAds =
    [
        "#player-ads",
        "ytd-companion-slot-renderer",
        "ytd-action-companion-ad-renderer",
        "ytd-player-legacy-desktop-watch-ads-renderer",
        ".video-ads.ytp-ad-module",
        ".ytp-ad-overlay-container",
        ".ytp-ad-overlay-image",
        ".ytp-ad-visit-advertiser-button",
        ".ytp-ad-player-overlay",
        ".ytp-ad-player-overlay-layout",
        ".ytp-ad-badge",
        ".ytp-ad-action-interstitial",
        ".ytp-ad-action-interstitial-slot",
        ".ytp-ad-image-overlay",
        ".ytp-ad-text-overlay",
        ".ytp-ad-message-container",
        ".ytp-ad-preview-container",
        ".ytp-ad-progress-list",
        ".ytp-ad-survey",
        ".html5-video-player.ad-showing .html5-video-container",
        ".html5-video-player.ad-interrupting .html5-video-container",
    ];

    public static readonly string[] Popups =
    [
        "ytd-mealbar-promo-renderer",
        "yt-mealbar-promo-renderer",
        "ytmusic-mealbar-promo-renderer",
        "ytd-popup-container tp-yt-paper-dialog:has(ytd-mealbar-promo-renderer)",
        "ytd-popup-container tp-yt-paper-dialog:has(ytmusic-mealbar-promo-renderer)",
    ];
}
