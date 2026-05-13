# static-entra-id-auth-example

A minimal, working reference for hosting a static site on **Azure Static Web Apps (Free plan)** where some pages are public and others require sign-in with **Microsoft Entra ID**. Built around a fictional "Contoso" annual report: the landing page is open to anyone, but the report and strategy pages are restricted to invited board members.

It uses only Azure's built-in (pre-configured) authentication — no app registration, no secrets, no API functions — so it works entirely on the Free plan.

---

## What's in here

```
src/
├── index.html                  Public landing page
├── report.html                 Protected: requires 'boardmember' role
├── strategy.html               Protected: requires 'boardmember' role
├── 403.html                    Shown to signed-in users without the role
├── styles.css                  Shared stylesheet
├── auth.js                     Reads /.auth/me, renders Sign in / Sign out
└── staticwebapp.config.json    Routes, role gates, 401 -> login, 403 -> 403.html
```

No build step, no dependencies. Azure serves `src/` directly.

---

## How the auth works

Azure Static Web Apps exposes a small set of system endpoints under `/.auth` that the platform handles for you. This project uses three of them:

| Endpoint | Purpose |
|---|---|
| `/.auth/login/aad` | Start a Microsoft Entra ID sign-in |
| `/.auth/logout` | Sign out |
| `/.auth/me` | Return JSON describing the current user (or `null` if anonymous) |

`auth.js` calls `/.auth/me` on each page and renders either a "Sign in" link or "Signed in as <name>" + "Sign out" in the header.

`staticwebapp.config.json` does the actual access control:

- `/report.html` and `/strategy.html` set `"allowedRoles": ["boardmember"]`.
- A 401 response (anonymous user hitting a protected route) is overridden into a 302 redirect to `/.auth/login/aad?post_login_redirect_uri=.referrer`, so users come back to the page they were trying to visit.
- A 403 response (signed in, but no role) is rewritten to `/403.html`.
- We return 404 on `/.auth/login/github` so Entra ID is the only sign-in path. (X/Twitter is already disabled platform-wide; Google/Facebook were never pre-configured.)

The roles `anonymous` and `authenticated` are built in — you don't define them. `boardmember` is a custom role, just a string we picked; it's matched against whatever roles a user is granted via the invitation system.

> **Heads up about the pre-configured Entra ID provider:** on the Free plan it's *multi-tenant* — any Microsoft account anywhere can complete the sign-in flow. The only thing stopping random signed-in users from reading the report is that `allowedRoles` requires `boardmember`, and that role only gets granted via invitation. Restricting sign-in *itself* to your tenant requires the Standard plan + a custom Entra app (see [Cost & plan upgrades](#cost--plan-upgrades) below).

---

## Deploy via the Azure Portal (CI/CD set up automatically)

1. **portal.azure.com** → search **Static Web Apps** → **Create**.
2. Fill in:
   - **Subscription / Resource group**: yours (create a new RG if needed).
   - **Name**: anything (e.g. `swa-entra-demo`).
   - **Plan type**: **Free**.
   - **Region for API**: nearest to you (irrelevant here since we have no API).
   - **Source**: **GitHub** → authorize → pick this repo / `main`.
   - **Build preset**: **Custom**.
   - **App location**: `/src`
   - **Api location**: *(leave empty)*
   - **Output location**: *(leave empty)*
3. **Review + create** → **Create**.

Azure will push a workflow file (`.github/workflows/azure-static-web-apps-*.yml`) to your repo and trigger the first build. Every subsequent push to `main` redeploys automatically — that's the built-in CI/CD.

Once the run completes, the SWA's **Overview** blade shows your URL (`*.azurestaticapps.net`). Open it; the landing page should load and the navigation links to the report should bounce you through a Microsoft sign-in.

---

## Invite your board members

After the SWA exists you can grant individual users the `boardmember` role:

1. In the SWA resource → **Settings** → **Role management** → **+ Invite**.
2. **Authorization provider**: `aad`.
3. **Invitee details**: their Microsoft account email (e.g. `name@company.com`).
4. **Domain**: pick your `*.azurestaticapps.net` URL (or your custom domain).
5. **Role**: `boardmember`.
6. **Maximum hours valid**: up to `168` (7 days — the cap on the invite link itself; the role assignment is permanent once accepted).
7. **Generate** → copy the invite link → send it to them.

They open the link, sign in with the matching Microsoft account, accept, and from then on can access `/report.html` and `/strategy.html`.

To revoke: same blade, select the user, **Delete**.

---

## Verified limits (from Microsoft Learn)

All numbers below are from the official [Azure Static Web Apps quotas page](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas). They apply per app unless noted.

| Limit | Free | Standard |
|---|---|---|
| Included bandwidth per month | 100 GB | 100 GB |
| Overage bandwidth | **Not available** (app stops serving) | $0.20 per GB |
| Max apps per subscription | 10 | 100 |
| Preview environments per app | 3 | 10 |
| Total storage (all environments) | 500 MB | 2 GB |
| Storage per single environment | 250 MB | 500 MB |
| File count per app | 15,000 | 15,000 |
| Custom domains per app | 2 | 6 |
| Private endpoint | Not available | 1 |
| IP range restrictions | Not available | 25 |
| **Authorization via invitations** | **25 users** | **25 users** |
| Authorization via serverless function | Not available | Unlimited |
| Max request size | 30 MB | 30 MB |

Two limits worth highlighting for this project:

- **The 25-user invitation cap is the same on Free and Standard.** It is *not* a Free-plan-only limit. To go beyond 25 invited users you need the *serverless function* role-assignment path, which is Standard-only.
- **Free plan has no bandwidth overage.** If you blow past 100 GB/month, the app stops serving until the meter resets — it does not silently bill you. For a board report site this is essentially impossible to hit.

---

## Cost & plan upgrades

Current pricing: see [Azure Static Web Apps pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) — Microsoft updates this page, so check it rather than trusting a number quoted here.

**Reasons you'd move from Free to Standard:**

| Need | Free | Standard |
|---|---|---|
| Public site, optional sign-in with any Microsoft account | ✅ | ✅ |
| Gate pages by hand-invited users (up to 25) | ✅ | ✅ |
| Restrict sign-in to a specific Entra tenant | ❌ | ✅ (custom Entra app required) |
| Assign roles from an Entra group | ❌ | ✅ (roles function required) |
| More than 25 users without writing code | ❌ | ❌ (need serverless function) |
| More than 25 users *with* a roles function | ❌ | ✅ |
| Custom domain SSL | ✅ | ✅ |
| SLA | ❌ | ✅ |
| Private endpoint / IP restrictions | ❌ | ✅ |

If you ever switch to Standard + a real Entra app + group-based roles, you'd change three things:

1. Register an app in Entra ID, configure it as a custom provider in `staticwebapp.config.json` (see the [Custom authentication](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom) doc).
2. Add an API function under `/api/GetRoles` that reads the user's Entra group claims and returns the SWA roles to assign.
3. Set `auth.rolesSource: "/api/GetRoles"` in the config.

The HTML pages and the `allowedRoles` rules don't change — only how roles are assigned changes.

---

## Local development (optional)

To run with the real `/.auth/*` endpoints locally, install the SWA CLI and point it at `src/`:

```bash
npm install -g @azure/static-web-apps-cli
swa start src
```

The CLI emulates the auth flow with a mock user. See [Azure Static Web Apps CLI](https://azure.github.io/static-web-apps-cli/) for details.

If you just open `src/index.html` directly in a browser, the auth UI will fall back to a "Sign in" link that does nothing locally — the public content still renders fine.

---

## References (Microsoft Learn)

These were used to build this project. They're current as of when this README was written; check the page dates if you're reading this much later.

- [Quotas in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas) — the authoritative table for plan limits.
- [Authenticate and authorize Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization) — built-in providers, `/.auth/*` endpoints, the warning about X (Twitter), how to set up sign-in and sign-out, the note that the pre-configured Entra ID provider accepts any Microsoft account.
- [Custom authentication in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom) — the Standard-only path for your own Entra app, role management via invitations vs. via a serverless function, the 168-hour invitation cap, `rolesSource`.
- [Configuration for Static Web Apps (`staticwebapp.config.json`)](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration) — the full schema reference for routes, `allowedRoles`, `responseOverrides`, and `navigationFallback`.
- [Pricing — Static Web Apps](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) — current monthly cost for Standard.
