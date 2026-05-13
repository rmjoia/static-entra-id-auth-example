# Static site on Azure SWA with Microsoft Entra ID auth

A working reference for setting up **Azure Static Web Apps** with **Microsoft Entra ID** authentication on selected pages. A public landing page is open to anyone; an annual report and strategy page are restricted to invited users. Entirely on the Free plan, no app registration, no secrets, no API functions.

The website itself is just dressing &mdash; Bootstrap 5 + Chart.js loaded from CDN for an "admin dashboard" look. The interesting part is everything below.

---

## Deploy via the Azure Portal

The portal sets up the GitHub Actions CI/CD pipeline for you. No CLI required.

1. **portal.azure.com** &rarr; search **Static Web Apps** &rarr; **Create**.
2. Fill in:
   - **Subscription / Resource group**: yours (create a new RG if needed).
   - **Name**: anything, e.g. `swa-entra-demo`.
   - **Plan type**: **Free**.
   - **Region**: nearest to you.
   - **Source**: **GitHub** &rarr; authorize &rarr; pick the repo / `main`.
   - **Build preset**: **Custom**.
   - **App location**: `/src`
   - **Api location**: *(leave empty)*
   - **Output location**: *(leave empty)*
3. **Review + create** &rarr; **Create**.

Azure commits a workflow file (`.github/workflows/azure-static-web-apps-*.yml`) to your repo and triggers the first build. Every subsequent push to `main` redeploys automatically.

Once the first run completes, the SWA's **Overview** blade shows your URL (`*.azurestaticapps.net`). Open it; the landing page should load and the navigation links to the report should bounce you through a Microsoft sign-in.

---

## How authentication is wired up

### The Free-plan path (used here): pre-configured Microsoft Entra ID

Azure SWA ships with **two pre-configured identity providers** that work out of the box on every plan: Microsoft Entra ID (alias `aad`) and GitHub. No app registration, no secrets, no config beyond what's in `staticwebapp.config.json`. ([Authenticate and authorize Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization))

The platform exposes three endpoints automatically:

| Endpoint | Purpose |
|---|---|
| `/.auth/login/aad` | Start a Microsoft Entra ID sign-in |
| `/.auth/logout` | Sign out |
| `/.auth/me` | Return JSON describing the current user |

> The pre-configured Entra ID provider is **multi-tenant** &mdash; any Microsoft account anywhere can complete the sign-in flow. Authorization is what stops them from reading anything: a protected route requires the `boardmember` role, and that role is only granted through invitations. To restrict sign-in *itself* to your tenant, see [Upgrade to Standard](#upgrading-to-standard) below.

### Authorisation: roles in `staticwebapp.config.json`

Every signed-in user automatically belongs to the built-in `authenticated` role; anonymous visitors belong to `anonymous`. On top of that you define **custom roles** &mdash; just strings &mdash; and gate routes with `allowedRoles`. This sample uses one custom role called `boardmember`:

```jsonc
{
  "routes": [
    { "route": "/report.html",   "allowedRoles": ["boardmember"] },
    { "route": "/strategy.html", "allowedRoles": ["boardmember"] },
    // Block GitHub so Entra ID is the only sign-in path.
    { "route": "/.auth/login/github", "statusCode": 404 }
  ],
  "responseOverrides": {
    "401": { "redirect": "/.auth/login/aad?post_login_redirect_uri=.referrer", "statusCode": 302 },
    "403": { "rewrite": "/403.html" }
  }
}
```

`.referrer` is a magic value the platform substitutes with the URL the user was originally trying to reach &mdash; so a deep link into `/report.html` bounces them through sign-in and back to that exact page. ([Configuration schema](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration))

---

## Inviting users (granting the `boardmember` role)

On the Free plan there is one way to grant a custom role: **send the user an invitation link from the Azure Portal**.

1. SWA resource &rarr; **Settings** &rarr; **Role management** &rarr; **+ Invite**.
2. **Authorization provider**: `aad`.
3. **Invitee details**: their Microsoft account email (e.g. `name@company.com`).
4. **Domain**: pick your `*.azurestaticapps.net` URL (or a custom domain if you've attached one).
5. **Role**: `boardmember`.
6. **Maximum hours valid**: up to **168** (7 days &mdash; the cap on the invite *link*; the role assignment is permanent once accepted). ([Manage roles](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom#manage-roles))
7. **Generate** &rarr; copy the link &rarr; send it to the user.

They open the link, sign in with the matching Microsoft account, accept, and from then on can access `/report.html` and `/strategy.html`. To revoke: same blade &rarr; select the user &rarr; **Delete**.

---

## Upgrading to Standard

Two scenarios where the Free plan stops being enough:

### Scenario A: restrict sign-in to your own Entra tenant

The pre-configured `aad` provider lets any Microsoft account sign in. To restrict to your tenant (or to a specific set of users), you register **your own Entra ID app** and tell SWA to use it. This is **Standard plan only**, because using any custom registration disables all pre-configured providers. ([Custom authentication](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom))

What changes:

- You register an app in **Microsoft Entra ID** (Azure Portal &rarr; Microsoft Entra ID &rarr; App registrations &rarr; New). Configure its supported account types and add the SWA callback URL.
- You add **application settings** on the SWA (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET_APP_SETTING_NAME`).
- You add an `auth` section to `staticwebapp.config.json` pointing at your tenant's OpenID Connect issuer.

The Role management blade in the portal is **not** where this configuration happens. The Role management blade is only for the invitation system. The custom-provider configuration lives in `staticwebapp.config.json` plus application settings, with the Entra app itself created in the Entra ID portal.

### Scenario B: assign roles from an Entra ID group (no per-user invites)

This is the question that motivates most upgrades. Suppose you have a group `security-group-board-members` with 100 members and you want everyone in that group to automatically get the `boardmember` role.

**You do not have to invite anyone.** The invitation system in Role management is only one of two ways to assign custom roles; the other is a **roles-assignment function**, available on Standard.

How it works ([Manage roles &mdash; function tab](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom#manage-roles)):

1. Register a custom Entra ID provider (Scenario A above) and configure it to emit the user's group memberships in its token (Entra **Token configuration** &rarr; add optional claim `groups`).
2. Add an API function at, say, `/api/GetRoles`. It receives the user's claims at sign-in and returns the SWA roles to assign:

   ```js
   // pseudo-code
   const groupIds = req.body.claims
     .filter(c => c.typ === "groups")
     .map(c => c.val);
   const roles = groupIds.includes("<board-group-object-id>") ? ["boardmember"] : [];
   return { roles };
   ```

3. Point the platform at it from `staticwebapp.config.json`:

   ```jsonc
   {
     "auth": {
       "rolesSource": "/api/GetRoles",
       "identityProviders": { /* your custom aad config */ }
     }
   }
   ```

Once configured, **the built-in invitations system is ignored** &mdash; the function is the single source of truth on every sign-in. Add or remove someone from the Entra group and their access updates the next time they sign in. There is no per-app user list to maintain, and there is no 25-user cap.

To answer the specific question directly: with a `security-group-board-members` group of 100 members on Standard + custom Entra app + `/api/GetRoles`, you invite zero users, you maintain membership entirely in Entra ID, and all 100 get access automatically.

---

## Verified limits (per app)

From the official [Azure SWA quotas page](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas):

| Limit | Free | Standard |
|---|---|---|
| Included bandwidth per month | 100 GB | 100 GB |
| Overage bandwidth | **Not available** (app stops serving) | $0.20 per GB |
| Apps per subscription | 10 | 100 |
| Preview environments per app | 3 | 10 |
| Total storage (all environments) | 500 MB | 2 GB |
| Storage per environment | 250 MB | 500 MB |
| File count per app | 15,000 | 15,000 |
| Custom domains per app | 2 | 6 |
| Private endpoint | &mdash; | 1 |
| IP range restrictions | &mdash; | 25 |
| **Authorisation via invitations** | **25 users** | **25 users** |
| Authorisation via serverless function | &mdash; | Unlimited |
| Max request size | 30 MB | 30 MB |

Two limits to note up front:

- **The 25-user invitation cap applies to both plans.** It is not a Free-plan-only limit. To go beyond 25 users without writing code, you'd need to extend the invitation list each time someone leaves; to scale further, you need the serverless-function approach (Standard only).
- **Free plan has no bandwidth overage.** If the app exceeds 100 GB/month, it stops serving until the meter resets. It does not silently bill you.

---

## Cost summary

Current pricing: [Azure SWA pricing page](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) (check there rather than trusting a number quoted here &mdash; Microsoft updates it).

When you'd move from Free to Standard:

| Need | Free | Standard |
|---|---|---|
| Public site, optional sign-in with any Microsoft account | &check; | &check; |
| Hand-invited users up to 25 | &check; | &check; |
| Restrict sign-in to a specific Entra tenant | &mdash; | &check; |
| Assign roles automatically from an Entra ID group | &mdash; | &check; |
| More than 25 users without writing code | &mdash; | &mdash; |
| More than 25 users with a roles function | &mdash; | &check; |
| Custom domain with SSL | &check; | &check; |
| SLA | &mdash; | &check; |
| Private endpoint / IP restrictions | &mdash; | &check; |

---

## References (Microsoft Learn)

- [Quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas) &mdash; authoritative plan limits.
- [Authenticate and authorize Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization) &mdash; built-in providers, `/.auth/*` endpoints, sign-in/sign-out, the note that the pre-configured Entra ID provider accepts any Microsoft account.
- [Custom authentication](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom) &mdash; Standard-only path for your own Entra app; role management via invitations vs serverless function; the 168-hour invitation cap; `rolesSource`.
- [Configuration (`staticwebapp.config.json`)](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration) &mdash; full schema for routes, `allowedRoles`, `responseOverrides`, `navigationFallback`.
- [Pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) &mdash; current Standard plan cost.
