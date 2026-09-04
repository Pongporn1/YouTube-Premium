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
        "ytd-promoted-sparkles-web-renderer",
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

    public static readonly string[] Popups =
    [
        "ytd-mealbar-promo-renderer",
        "yt-mealbar-promo-renderer",
        "ytd-popup-container tp-yt-paper-dialog:has(ytd-mealbar-promo-renderer)",
    ];
}
