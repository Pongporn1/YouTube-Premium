export function accountStorageKey(email, key) {
  const owner = String(email || "").trim().toLowerCase();
  return owner ? `mytube-account:${encodeURIComponent(owner)}:${key}` : null;
}
export function migrateOwnerStorage(storage, email, keys) {
  // Unlabelled data predates family support and belongs only to the original owner.
  if (email !== "ballboss6184@gmail.com") return;
  for (const key of keys) {
    const target = accountStorageKey(email, key);
    const old = storage.getItem(key);
    if (old !== null && storage.getItem(target) === null) storage.setItem(target, old);
    if (old !== null) storage.removeItem(key);
  }
}
