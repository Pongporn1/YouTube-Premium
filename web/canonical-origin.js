const canonicalHostname = "mytube-private-web.vercel.app";

if (
  location.protocol === "https:" &&
  location.hostname.endsWith(".vercel.app") &&
  location.hostname !== canonicalHostname &&
  !new URLSearchParams(location.search).has("preview")
) {
  location.replace(`https://${canonicalHostname}${location.pathname}${location.search}${location.hash}`);
}
