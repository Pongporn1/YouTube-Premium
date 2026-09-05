// Owner-approved accounts only. Changes require access to the project's server configuration.
export const MAX_ACCOUNTS = 10;
const approvedFamily = ["ballboss6184@gmail.com", "bossy.2549s@gmail.com"];
export function allowedAccounts(env = process.env) {
  const emails = [...new Set([...approvedFamily, ...String(env.ALLOWED_GOOGLE_EMAIL || "").split(",")]
    .map(value => value.trim().toLowerCase()).filter(Boolean))];
  if (emails.length > MAX_ACCOUNTS) return new Set(); // Fail closed, never silently admit an eleventh account.
  return new Set(emails);
}
export function isApproved(email) {
  return allowedAccounts().has(String(email || "").trim().toLowerCase());
}
