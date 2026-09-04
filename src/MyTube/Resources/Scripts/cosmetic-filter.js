(() => {
    const styleId = "mytube-cosmetic-filter";
    let style = document.getElementById(styleId);
    if (!style) {
        style = document.createElement("style");
        style.id = styleId;
        document.documentElement.appendChild(style);
    }

    style.textContent = __MYTUBE_CSS_JSON__;
})();
