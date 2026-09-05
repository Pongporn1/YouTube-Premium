// Session-only result data, isolated by signed-in account. Never store credentials.
export function createResultCache(storage, now = Date.now) {
  const key = 'mytube-results-v1';
  const read = () => { try { return JSON.parse(storage.getItem(key) || '{}'); } catch { return {}; } };
  return {
    get(owner, resource) {
      if (!owner) return null;
      const entry = read()?.[JSON.stringify([owner, resource])];
      if (!entry || !Array.isArray(entry.data?.items) || !Number.isFinite(entry.at) || now() - entry.at > 86400000 || entry.at > now()) return null;
      return { ...entry, fresh: now() - entry.at < 600000 };
    },
    put(owner, resource, data) {
      if (!owner || !Array.isArray(data?.items)) return;
      try {
        const entries = read() || {};
        entries[JSON.stringify([owner, resource])] = { at: now(), data };
        const kept = Object.entries(entries).filter(([, e]) => now() - e.at < 86400000)
          .sort((a,b) => b[1].at - a[1].at).slice(0, 30);
        storage.setItem(key, JSON.stringify(Object.fromEntries(kept)));
      } catch { /* Disabled/full storage must not interrupt playback. */ }
    },
    clear() { try { storage.removeItem(key); } catch { /* unavailable */ } }
  };
}
