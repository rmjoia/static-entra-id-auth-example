# Static site on Azure SWA with Microsoft Entra ID auth

Two working reference examples for hosting a static site on **Azure Static Web Apps** where some pages are public and others require sign-in with **Microsoft Entra ID**.

| Folder | Plan | Auth approach | Use when |
|---|---|---|---|
| [`free-tier/`](free-tier/) | Free | Pre-configured Entra ID + per-user invitations | You want zero-config auth and have <=25 users. Anyone with a Microsoft account *can* attempt sign-in; only invited users get access. |
| [`standard-tier/`](standard-tier/) | Standard | Custom Entra app + group-based role assignment via Azure Function | You want sign-in restricted to your tenant, and you want to grant access by adding people to an Entra ID security group instead of inviting them one at a time. |

Both examples render the same Bootstrap 5 + Chart.js "Contoso annual review" dashboard. The interesting differences are in `staticwebapp.config.json` and (for Standard) the `api/GetRoles` Azure Function.

The repo can host both at once: create two SWAs in the portal, point one at `/free-tier/src` and the other at `/standard-tier/src`. Each gets its own GitHub Actions workflow file and runs independently.

---

## Free-tier example

Everything in `free-tier/`. No app registration, no secrets, no API.

### Deploy via the Azure Portal

1. **portal.azure.com** &rarr; search **Static Web Apps** &rarr; **Create**.
2. Fill in:
   - **Plan type**: **Free**.
   - **Source**: **GitHub** &rarr; authorize &rarr; pick this repo / `main`.
   - **Build preset**: **Custom**.
   - **App location**: `/free-tier/src`
   - **Api location**: *(leave empty)*
   - **Output location**: *(leave empty)*
3. **Create**. Azure pushes a workflow file (`azure-static-web-apps-<name>-<id>.yml`) to the repo and triggers the first deploy.

### Authentication flow

The platform exposes three endpoints automatically (see [Authenticate and authorize Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization)):

| Endpoint | Purpose |
|---|---|
| `/.auth/login/aad` | Start a Microsoft Entra ID sign-in |
| `/.auth/logout` | Sign out |
| `/.auth/me` | Return JSON describing the current user (source of truth for roles) |

`free-tier/src/staticwebapp.config.json` gates `/report.html` and `/strategy.html` on the custom role `boardmember`. Anonymous users get redirected to `/.auth/login/aad?post_login_redirect_uri=.referrer` (`.referrer` is a magic value the platform substitutes with the originating URL); signed-in users without the role get a friendly `/403.html` rewrite.

> The pre-configured Entra ID provider is **multi-tenant**. Any Microsoft account can complete the sign-in handshake. Authorisation, not authentication, is what stops them: the `boardmember` role only gets granted by you, via invitation.

### Invite a user

1. SWA resource &rarr; **Settings** &rarr; **Role management** &rarr; **+ Invite**.
2. **Authorization provider**: `aad`.
3. **Invitee details**: their Microsoft account email.
4. **Domain**: pick your `*.azurestaticapps.net` URL.
5. **Role**: `boardmember` (case-sensitive, no surrounding whitespace).
6. **Maximum hours valid**: up to **168** (7 days &mdash; the cap on the invite *link*; the role assignment is permanent once accepted).
7. **Generate** &rarr; copy the link &rarr; send it.

The user opens the link, signs in with the matching Microsoft account, accepts, and from then on can access the protected pages.

---

## Standard-tier example

Everything in `standard-tier/`. Includes an Azure Function under `standard-tier/api/` that translates Entra group membership into SWA roles. This means **you never invite individual users**: anyone in your designated security group gets access automatically on their next sign-in. Removing them from the group removes access.

### One-time Entra app registration (in the tenant that owns the group)

> If you're putting the Free example in your personal subscription and the Standard example in an org tenant, switch the Azure portal **Directory** to the org tenant *before* doing any of this. The app registration must live in the same directory as the security group.

1. **Microsoft Entra ID** &rarr; **App registrations** &rarr; **+ New registration**.
2. **Name**: anything (e.g. `swa-standard-tier-demo`).
3. **Supported account types**: **Accounts in this organizational directory only (single tenant)**.
4. **Redirect URI**: Web &rarr; `https://<YOUR_SWA>.azurestaticapps.net/.auth/login/aad/callback`. You'll know the final hostname once you create the SWA; you can come back and edit this if needed.
5. **Register**. From the **Overview** blade, copy the **Application (client) ID** and **Directory (tenant) ID** &mdash; you'll need both.
6. **Certificates &amp; secrets** &rarr; **+ New client secret**. Set a description and expiry, click **Add**, and immediately copy the **Value** column (not the Secret ID). You won't be able to see it again.
7. **Token configuration** &rarr; **+ Add optional claim** &rarr; **ID** &rarr; check `groups` &rarr; **Add**. If prompted "Turn on the Microsoft Graph email, profile, openid permission", accept it.
8. **API permissions** &rarr; confirm `Microsoft Graph -> User.Read (Delegated)` is present. Nothing else required for the group-claim flow.

> **Group claim "overage"**: if a user is in more than ~150 groups, Entra omits the `groups` claim and instead emits `_claim_names` + `_claim_sources` pointing to Graph. This sample doesn't implement the Graph fallback &mdash; for small teams it's fine, but if your users are in large numbers of groups, see the Microsoft Learn [Assign roles using Microsoft Graph](https://learn.microsoft.com/en-us/azure/static-web-apps/assign-roles-microsoft-graph) tutorial.

### Capture the security group's Object ID

**Microsoft Entra ID** &rarr; **Groups** &rarr; pick your group (e.g. `security-group-board-members`) &rarr; copy the **Object ID** from the Overview blade. This is what the GetRoles function compares against.

### Deploy the SWA

1. **portal.azure.com** in the same tenant &rarr; **Create a Static Web App**.
2. **Plan type**: **Standard**.
3. **Source**: **GitHub** &rarr; pick this same repo / `main`.
4. **Build preset**: **Custom**.
5. **App location**: `/standard-tier/src`
6. **Api location**: `/standard-tier/api`
7. **Output location**: *(empty)*
8. **Create**. A second workflow file (`azure-static-web-apps-<new-name>-<id>.yml`) gets pushed to the repo. Both workflows now coexist: the Free workflow keeps deploying `/free-tier/src` to the personal-subscription SWA, the Standard one deploys `/standard-tier/src` + `/standard-tier/api` to the org-tenant SWA.

### Wire the secrets into the SWA

On the Standard SWA resource: **Settings** &rarr; **Environment variables** (or **Configuration** depending on portal vintage) &rarr; add three application settings:

| Setting name | Value |
|---|---|
| `AZURE_CLIENT_ID` | The Application (client) ID from step 5 above. |
| `AZURE_CLIENT_SECRET` | The client secret **Value** from step 6 above. |
| `BOARD_GROUP_ID` | The Object ID of your security group. |

Save. These are read at runtime by the platform (`AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`) and by the Function (`BOARD_GROUP_ID`).

### Update the tenant ID in `staticwebapp.config.json`

Open `standard-tier/src/staticwebapp.config.json` and replace `<TENANT_ID>` in the `openIdIssuer` URL with your **Directory (tenant) ID** from the app registration. Commit and push &mdash; the next CI run picks it up.

```jsonc
"openIdIssuer": "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0"
```

### How the role assignment works

Once `auth.rolesSource` is configured, **the built-in invitations system is ignored**. Every time a user signs in:

1. The platform POSTs the user's claims to `/api/GetRoles` (Azure Function defined at `standard-tier/api/src/functions/GetRoles.js`).
2. The function filters the `claims` array for entries with `typ === "groups"` and collects the group Object IDs.
3. If `BOARD_GROUP_ID` is in that set, it returns `{ "roles": ["boardmember"] }`. Otherwise it returns `{ "roles": [] }`.
4. The platform attaches those roles to the user's session.

So to grant a user access: add them to the Entra security group. To revoke: remove them from the group. They'll see the change on their next sign-in. No invitation links, no 25-user cap, no per-app user list.

---

## Troubleshooting auth

These are the gotchas you're almost guaranteed to hit at some point. `/.auth/me` is the source of truth for what the platform sees &mdash; always start there.

- **Role change doesn't take effect.** The platform issues a cookie at sign-in; that cookie holds your roles for its lifetime. Editing roles in the portal (Free) or moving someone in/out of an Entra group (Standard) won't update an *existing* session. The user must sign out (`/.auth/logout` directly) and sign in again. Incognito helps you be sure you're getting a fresh cookie.

- **Role propagation lag.** After you change a role, propagation across edge nodes takes "a few minutes" (per [Manage roles docs](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom#manage-roles)). During that window, refreshing `/.auth/me` can return different `userRoles` from one request to the next. It's not your config; just wait 5&ndash;15 minutes and it'll stabilise.

- **The Role Management blade can lie.** What it shows is not always exactly what's in the active session. Trust `/.auth/me`. If `/.auth/me` consistently doesn't contain the role but the blade says it should, edit the user's `Role` field in the blade (e.g. set it to `contributor,boardmember`), save, then sign out and back in.

- **Role names are case-sensitive and whitespace-sensitive.** `boardmember` &ne; `BoardMember` &ne; `boardmember ` (trailing space). Both the value in `allowedRoles` and the value you typed in the invitation / portal must match exactly.

- **Invited *with* a role vs. edited *after* invitation.** If you invited someone before the role existed, you have to edit their existing user record in Role Management to add the role &mdash; just creating a *new* invitation for the same user doesn't replace their existing record. Either path works; just remember the fresh-sign-in step.

- **`anonymous` and `authenticated` are built-in.** Both always appear in `userRoles` once signed in &mdash; that's normal, not a bug. Don't try to remove them.

- **Invitation generated for the wrong domain.** When generating the invite, the **Domain** dropdown determines which hostname the assignment is bound to. If you have multiple custom domains, pick the one the user will actually browse to.

- **(Standard) Groups missing from the token.** If your user is in more than ~150 Entra groups, the `groups` claim is omitted and GetRoles will see `groupCount=0`. See the overage note above.

---

## Verified limits (per app)

From the [Azure SWA quotas page](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas):

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

Two limits worth highlighting:

- **The 25-user invitation cap applies to both plans.** It's not a Free-only limit. The Standard plan only escapes it by switching to the role-assignment function (what the `standard-tier/` example demonstrates).
- **Free plan has no bandwidth overage.** Past 100 GB/month, the app stops serving until the meter resets. It does not silently bill you.

---

## Cost summary

Current pricing: [Azure SWA pricing page](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) &mdash; Microsoft updates it, so check there.

When you'd move from Free to Standard:

| Need | Free | Standard |
|---|---|---|
| Public site, sign-in with any Microsoft account | &check; | &check; |
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

- [Quotas in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas) &mdash; authoritative plan limits.
- [Authenticate and authorize Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization) &mdash; built-in providers, `/.auth/*` endpoints, sign-in/sign-out, the note that the pre-configured Entra ID provider accepts any Microsoft account.
- [Custom authentication in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom) &mdash; Standard-only path for your own Entra app; role management via invitations vs serverless function; the 168-hour invitation cap; `rolesSource`.
- [Configuration (`staticwebapp.config.json`)](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration) &mdash; full schema for routes, `allowedRoles`, `responseOverrides`, `navigationFallback`, and the `auth` block.
- [Tutorial: Assign roles via Microsoft Graph](https://learn.microsoft.com/en-us/azure/static-web-apps/assign-roles-microsoft-graph) &mdash; the Graph-based fallback for users in >150 groups.
- [Pricing &mdash; Static Web Apps](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) &mdash; current Standard plan cost.
