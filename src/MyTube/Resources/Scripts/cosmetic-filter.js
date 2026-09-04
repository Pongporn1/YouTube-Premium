(() => {
    const styleId = "mytube-cosmetic-filter";
    const blockerKey = "__myTubePlayerAdBlocker";
    const css = __MYTUBE_CSS_JSON__;
    const blockPlayerAds = __MYTUBE_BLOCK_PLAYER_ADS__;
    const host = window.location.hostname.toLowerCase();
    const isYouTube = host === "youtube.com" || host.endsWith(".youtube.com");

    if (!isYouTube) {
        return;
    }

    if (window[blockerKey]) {
        window[blockerKey].configure(css, blockPlayerAds);
        return;
    }

    const state = {
        blockPlayerAds,
        css,
        activeVideo: null,
        previousMuted: false,
        previousVolume: 1,
        previousPlaybackRate: 1,
        scheduled: false
    };

    function ensureStyle() {
        if (!document.documentElement) {
            return;
        }

        let style = document.getElementById(styleId);
        if (!style) {
            style = document.createElement("style");
            style.id = styleId;
            document.documentElement.appendChild(style);
        }

        style.textContent = state.css;
    }

    function restoreVideo() {
        const video = state.activeVideo;
        if (!video) {
            return;
        }

        video.muted = state.previousMuted;
        video.volume = state.previousVolume;
        video.playbackRate = state.previousPlaybackRate;
        state.activeVideo = null;
    }

    function suppressPlayerAd() {
        state.scheduled = false;
        ensureStyle();

        if (!state.blockPlayerAds) {
            restoreVideo();
            return;
        }

        const player = document.querySelector(
            ".html5-video-player.ad-showing, .html5-video-player.ad-interrupting");
        if (!player) {
            restoreVideo();
            return;
        }

        const video = player.querySelector("video");
        if (video && state.activeVideo !== video) {
            restoreVideo();
            state.activeVideo = video;
            state.previousMuted = video.muted;
            state.previousVolume = video.volume;
            state.previousPlaybackRate = video.playbackRate;
        }

        if (video) {
            video.muted = true;
            video.volume = 0;

            try {
                if (Number.isFinite(video.duration) && video.duration > 0.1) {
                    video.currentTime = video.duration;
                } else {
                    video.playbackRate = 16;
                }
                video.play().catch(() => {});
            } catch {
                // YouTube may replace the media element while an ad is ending.
            }
        }

        const skipButton = player.querySelector([
            ".ytp-skip-ad-button",
            ".ytp-ad-skip-button",
            ".ytp-ad-skip-button-modern",
            ".ytp-ad-skip-button-container button",
            "[id^='skip-button'] button"
        ].join(","));
        if (skipButton instanceof HTMLElement) {
            skipButton.click();
        }
    }

    function scheduleSuppression() {
        if (state.scheduled) {
            return;
        }

        state.scheduled = true;
        requestAnimationFrame(suppressPlayerAd);
    }

    function start() {
        ensureStyle();
        if (!document.documentElement) {
            return;
        }

        const observer = new MutationObserver(scheduleSuppression);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
            childList: true,
            subtree: true
        });
        window.setInterval(suppressPlayerAd, 250);
        document.addEventListener("yt-navigate-start", scheduleSuppression);
        document.addEventListener("yt-navigate-finish", scheduleSuppression);
        suppressPlayerAd();
    }

    window[blockerKey] = {
        configure(nextCss, nextBlockPlayerAds) {
            state.css = nextCss;
            state.blockPlayerAds = nextBlockPlayerAds;
            ensureStyle();
            suppressPlayerAd();
        }
    };

    if (document.documentElement) {
        start();
    } else {
        document.addEventListener("readystatechange", start, { once: true });
    }
})();
