# Family access

Maximum: 10 distinct approved Google emails, including the owner. The server's
`api/auth/family-policy.js` contains the two explicitly approved family accounts.
`ALLOWED_GOOGLE_EMAIL` may contain additional owner-approved emails (comma-separated).
There is no self-registration or member-facing grant-access endpoint. Only the
owner/project administrator should have deployment/configuration access. To revoke
a member, remove them from both sources and deploy; every request rechecks approval.
An over-capacity configuration fails closed for all accounts.

Browser history, Watch Later, personalization and feed order are namespaced by the
verified sign-in email. Unlabelled legacy data migrates only to the original owner.
This is local browser storage, NOT encrypted storage or cross-device synchronization.
Use separate browser profiles on shared devices for stronger privacy.

YouTube OAuth requests readonly + openid/email. The server verifies the token's
Google subject and verified email against the signed MyTube session before use.
Subscriptions, likes and playlists come from that authorized YouTube account.
Native YouTube Home recommendations/history/Watch Later are not supplied by this integration.

Before release: add approved family members as OAuth test users if the Google app
is still in Testing. Verify actual login and YouTube consent on both accounts.
Quota is shared by the entire Google Cloud project. No demo password or token is stored.

Current approval management is deployment configuration, not an in-app owner dashboard.
