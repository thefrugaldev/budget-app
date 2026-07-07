# Auth: hosted Clerk for authentication only; household authorization owned in-app

## Status

Accepted (2026-07-03)

## Context

The app is going multi-user: sign-in via third-party OAuth, and sharing with a small number of people (spouse first) as viewers/editors. Nothing exists today — no middleware, no user scoping on any document. Two forces shaped the decision: a hosted provider concentrates security expertise we don't want to own for a finance app (a recent critical CVE in a popular self-hosted library, CVE-2025-61928, sharpened this), while a hosted provider also creates lock-in and puts identity data in SaaS. Additionally, this repo's Next.js 16 replaces `middleware.ts` with `proxy.ts`, and its docs push session verification into the data layer.

## Decision

**Clerk** (free Hobby tier, 50k MRU) handles **authentication only**: the Google OAuth flow (sole provider at v1), session issuance, and session verification. Everything else is ours:

1. **Authorization is in-app.** `Household`, `Member` (roles `owner | editor | viewer`), and `Invite` live in our Mongo collections, keyed by **our** user ids. Every server action and page loader verifies session → membership → role itself; the proxy does only an optimistic cookie redirect.
2. **The anti-lock-in seam.** The Clerk SDK appears in exactly three places: `lib/auth` (exporting `getCurrentUser()` and role guards that return *our* shapes), `proxy.ts`, and **the auth screens** — the sign-in screen and its symmetric counterpart, the Profile sign-out control (chunk 6). Both are authentication *UI* (clearing Clerk's session cookie needs the SDK); neither models domain data, which is what this seam actually guards. We do **not** use Clerk Organizations for households and do **not** store roles in Clerk user metadata — even though both are the tempting "idiomatic Clerk" path. Our `users` collection holds our stable id plus a provider link (`clerk`, Clerk's user id) and verified email; documents never reference Clerk ids.
3. **Deny by default.** An authenticated user with no membership and no matching invite gets a "private app" screen and zero data access — an independent layer above the auth library. Invites are owner-created email+role grants matched against the OAuth verified email; no email is ever sent. The first sign-in ever bootstraps: creates the household, becomes owner, and backfills `householdId` onto all pre-auth documents. Invite matching runs for *any* authenticated identity lacking a membership — not only never-seen users — so removing a member (chunk 6) is reversible: a fresh pending invite re-admits the same identity on their next sign-in rather than leaving a known email permanently locked out. Removal deletes the membership only; the `User` record and household-stamped data are left intact.

Migration away from Clerk (e.g. to Better Auth) is therefore: reimplement `lib/auth` internals, have users sign in with Google under the new provider, and relink by verified email to the same `users` docs. Memberships, households, and data are untouched.

## Consequences

- Login availability depends on Clerk uptime, and Hobby sessions are fixed at 7 days (a one-click Google re-login on a monthly-cadence app). MFA is Clerk-paywalled but irrelevant — Google accounts carry their own.
- The seam costs us Clerk conveniences (Organizations UI, `<SignedIn>` sprinkled through components) — deliberately. A future contributor "simplifying" onto Clerk Organizations or Clerk metadata roles would be re-creating the lock-in this ADR exists to prevent.
- The quote cache stays app-global (a price is not household data); every other collection gains `householdId`.
- "Account" remains reserved for financial accounts; the auth entity is the **User** (surface name: Profile).

## Considered alternatives

- **Better Auth (self-hosted).** TypeScript-first, Mongo adapter, Next 16-compatible, identities stay in our DB. Rejected on risk posture: a young library with a recent critical CVE (patched fast, and only in an unused plugin — but the bug class was an inverted auth check in core-adjacent code), for an app where we'd rather rent the security team. The seam keeps this reversible if the calculus changes.
- **Auth.js / NextAuth v5.** Same self-hosted risk class with slower maintenance momentum; no advantage over Better Auth for us.
- **Hand-rolled OAuth + sessions.** Small for one provider, but session hardening, CSRF, and token rotation are exactly the wheels not worth reinventing for a finance app.
- **Clerk Organizations as the household.** Rejected — moves the tenancy model into the vendor, the single worst lock-in surface. Households are domain data, not auth data.
- **Invite links / self-serve households.** Rejected — a tokened link is a leakable bearer credential needing expiry machinery, and self-serve tenancy invites strangers to store data in our Mongo; deny-by-default fits a private family app.

## Operational notes (Clerk instance)

Recorded during the chunk-3 rollout (#111):

- **Google is the sole sign-in method.** Email/password strategy and email-as-identifier are disabled in the dashboard; only the Google SSO connection is enabled.
- **Sign-ups are locked down.** The Clerk instance runs in **Restricted** sign-up mode, so no one can self-register. On the free (Hobby) plan the **Allowlist is Pro-gated**, so approved people are added either by **manually creating the user** in the dashboard (Users → Create user, by email) or via a **Clerk invitation**; **account linking on verified email** links their Google login to the pre-created user. This is authentication-layer gating only — it is *not* the lock-in this ADR guards against (that rule is about not modeling households/roles in Clerk).
- **Two independent gates today.** Clerk decides *who may authenticate*; our deny-by-default boundary decides *who may enter* (an authenticated user with no membership/invite gets the private-app screen, no residue). Until the in-app Invite UI ships (chunk 6), the only member is the owner via first-sign-in bootstrap — so the app is effectively owner-only regardless of Clerk settings.
- **Invite-only, permanently — resolved (2026-07-06).** The app stays invite-only for the foreseeable future, so the Clerk instance stays in **Restricted** sign-up mode (never Public). Because Restricted mode blocks an unknown email's sign-up *before* our deny-by-default gate runs, an invitee needs a Clerk identity to authenticate at all — provisioned **manually in the Clerk dashboard** (Users → Create user, by email) when the owner creates the in-app Invite. No email is sent (Clerk's invitation-email flow stays deliberately unused); **account linking on verified email** connects the invitee's Google login to the pre-created user, and our join flow then consumes the Invite. This was **chosen over automating provisioning via Clerk's Backend API** specifically to keep the anti-lock-in seam at its three touchpoints (`lib/auth`, `proxy.ts`, the sign-in screen) — the sharing flow must not come to depend on a Clerk API. At family scale (one or two invites ever) the manual dashboard step is negligible, and deny-by-default remains the real gate. If self-serve provisioning is ever wanted, a `provisionInvitee(email)` helper slots in behind the `lib/auth` boundary as an additive change — not a re-architecture. So chunk 6's Invite action is purely our-domain (create/revoke/change-role over our `invites`/`members` collections); the only Clerk-side step is the owner's manual dashboard add, which the Members & Invites UI should surface as a reminder on the invite confirmation.
