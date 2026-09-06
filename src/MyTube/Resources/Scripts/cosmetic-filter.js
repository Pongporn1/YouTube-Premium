(() => {
    const styleId = "mytube-cosmetic-filter";
    const blockerKey = "__myTubePlayerAdBlocker";
    const playerSelector = ".html5-video-player";
    const discoveryDelayMs = 500;
    const maxDiscoveryAttempts = 20;
    const adRetryDelayMs = 250;
    const maxAdRetryAttempts = 40;
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

    // Premium-style suppression: strip ad scheduling out of player responses
    // before the player reads them, so ads never start instead of being
    // muted/skipped after they appear. The player suppressor below stays as a
    // backstop for any ad that still slips through.
    const adDataKeys = ["adPlacements", "adSlots", "playerAds"];

    function prunePlayerAdData(data) {
        if (!data || typeof data !== "object") {
            return data;
        }

        try {
            for (const key of adDataKeys) {
                if (key in data) {
                    delete data[key];
                }
            }
            if (data.playerResponse && typeof data.playerResponse === "object") {
                prunePlayerAdData(data.playerResponse);
            }
        } catch {
            // A frozen response keeps its ad slots; the player suppressor still handles them.
        }

        return data;
    }

    function installResponsePruner() {
        try {
            const originalParse = JSON.parse;
            JSON.parse = function (text, reviver) {
                const result = originalParse.call(this, text, reviver);
                if (result && typeof result === "object") {
                    return prunePlayerAdData(result);
                }
                return result;
            };
        } catch {
            return;
        }

        try {
            let initialPlayerResponse;
            Object.defineProperty(window, "ytInitialPlayerResponse", {
                configurable: true,
                get: () => initialPlayerResponse,
                set: (value) => { initialPlayerResponse = prunePlayerAdData(value); }
            });
        } catch {
            // The property may already be bound; live suppression still covers playback.
        }
    }

    installResponsePruner();

    const state = {
        blockPlayerAds,
        css,
        activeVideo: null,
        previousMuted: false,
        previousVolume: 1,
        previousPlaybackRate: 1,
        adHandled: false,
        scheduled: false,
        observedPlayer: null,
        playerObserver: null,
        discoveryTimer: null,
        discoveryAttempts: 0,
        adRetryTimer: null,
        adRetryAttempts: 0
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

        if (style.textContent !== state.css) {
            style.textContent = state.css;
        }
    }

    function clearTimer(name) {
        if (state[name] !== null) {
            window.clearTimeout(state[name]);
            state[name] = null;
        }
    }

    function restoreVideo() {
        clearTimer("adRetryTimer");
        const video = state.activeVideo;
        if (video) {
            video.muted = state.previousMuted;
            video.volume = state.previousVolume;
            video.playbackRate = state.previousPlaybackRate;
        }

        state.activeVideo = null;
        state.adHandled = false;
        state.adRetryAttempts = 0;
    }

    function scheduleSuppression() {
        if (state.scheduled) {
            return;
        }

        state.scheduled = true;
        requestAnimationFrame(suppressPlayerAd);
    }

    function scheduleAdRetry() {
        if (state.adRetryTimer !== null || state.adRetryAttempts >= maxAdRetryAttempts) {
            return;
        }

        state.adRetryTimer = window.setTimeout(() => {
            state.adRetryTimer = null;
            state.adRetryAttempts++;
            scheduleSuppression();
        }, adRetryDelayMs);
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

        if (video && !state.adHandled) {
            state.adHandled = true;
            video.muted = true;
            video.volume = 0;

            try {
                // Seek past the ad when the stream allows it; some ad streams
                // reject seeks, so out-running the countdown at 16x is the fallback.
                video.playbackRate = 16;
                if (Number.isFinite(video.duration) && video.duration > 0.1) {
                    video.currentTime = video.duration;
                }
                video.play().catch(() => {});
            } catch {
                // YouTube can replace the media element while an ad is ending.
            }
        }

        const skipButton = player.querySelector([
            ".ytp-skip-ad-button",
            ".ytp-ad-skip-button",
            ".ytp-ad-skip-button-modern",
            ".ytp-ad-skip-button-container button",
            "[id^='skip-button'] button",
            "button[class*='ytp-ad-skip']",
            "button[class*='ytp-skip-ad']"
        ].join(","));
        if (skipButton instanceof HTMLElement) {
            skipButton.click();
            clearTimer("adRetryTimer");
        } else {
            scheduleAdRetry();
        }
    }

    function observePlayer(player) {
        clearTimer("discoveryTimer");
        if (state.observedPlayer === player) {
            return;
        }

        state.playerObserver?.disconnect();
        state.observedPlayer = player;
        state.playerObserver = new MutationObserver(scheduleSuppression);
        state.playerObserver.observe(player, {
            attributes: true,
            attributeFilter: ["class"]
        });
        scheduleSuppression();
    }

    function discoverPlayer(resetAttempts = false) {
        if (resetAttempts) {
            clearTimer("discoveryTimer");
            state.discoveryAttempts = 0;
        }

        const player = document.querySelector(playerSelector);
        if (player) {
            observePlayer(player);
            return;
        }

        state.playerObserver?.disconnect();
        state.playerObserver = null;
        state.observedPlayer = null;
        if (!state.blockPlayerAds
            || state.discoveryTimer !== null
            || state.discoveryAttempts >= maxDiscoveryAttempts) {
            return;
        }

        state.discoveryTimer = window.setTimeout(() => {
            state.discoveryTimer = null;
            state.discoveryAttempts++;
            discoverPlayer();
        }, discoveryDelayMs);
    }

    function stopPlayerWatchers() {
        state.playerObserver?.disconnect();
        state.playerObserver = null;
        state.observedPlayer = null;
        clearTimer("discoveryTimer");
        clearTimer("adRetryTimer");
    }

    function start() {
        ensureStyle();
        if (!document.documentElement) {
            return;
        }

        document.addEventListener("yt-navigate-start", () => {
            stopPlayerWatchers();
            restoreVideo();
        });
        document.addEventListener("yt-navigate-finish", () => discoverPlayer(true));
        discoverPlayer(true);
        suppressPlayerAd();
    }

    window[blockerKey] = {
        configure(nextCss, nextBlockPlayerAds) {
            state.css = nextCss;
            state.blockPlayerAds = nextBlockPlayerAds;
            ensureStyle();

            if (state.blockPlayerAds) {
                discoverPlayer(true);
                scheduleSuppression();
            } else {
                stopPlayerWatchers();
                restoreVideo();
            }
        }
    };

    if (document.documentElement) {
        start();
    } else {
        document.addEventListener("readystatechange", start, { once: true });
    }
})();
