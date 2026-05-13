# Static website with Microsoft sign-in (reference example)

A working example of a website where some pages are open to everyone and other pages require visitors to sign in with their Microsoft account before they can read them. Built on **Azure Static Web Apps** (Microsoft's service for hosting websites) with sign-in handled by **Microsoft Entra ID** (formerly called Azure Active Directory).

The example site is a fictional "Contoso" company annual review:

- The **Overview** page is public &mdash; anyone can read it.
- The **Annual Report** and **Strategy** pages are protected &mdash; only people you've given access to can read them.

This is the pattern you'd use for board reports, investor updates, partner-only documents, or any site where you want a public marketing page plus a private members-only area, without running a traditional server.

---

## What's in this repo

There are two complete versions of the same site, in two folders. Both versions look identical when visited; the only difference is **how visitors get permission to read the protected pages**.

| Folder | Sign-in setup | Who can read the protected pages | Cost |
|---|---|---|---|
| **[`free-tier/`](free-tier/)** | Uses Microsoft's built-in sign-in. No setup beyond clicking through the Azure portal. | Up to 25 people you invite one at a time, via emailed invitation links. | Free. |
| **[`standard-tier/`](standard-tier/)** | You register your own sign-in app in Microsoft Entra ID and connect it to a security group. | Everyone in the group automatically. No invitations needed. Add a person to the group &rarr; they can read. Remove them &rarr; they can't. | Standard-tier pricing (see [the pricing page](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) for the current number). |

> **Which one should you pick?** If you have a small, fixed audience (a board of 10, a handful of investors), use **Free**. If your audience changes often or is more than 25 people, or you already manage access via Entra groups, use **Standard**.

You can host both at the same time from this one repo &mdash; each becomes a separate website with its own URL.

---

## Contents

- [**Free-tier walkthrough**](#free-tier-walkthrough) &mdash; recommended starting point
  - [Before you start](#before-you-start-free)
  - [Step 1: Create the website in Azure](#step-1-create-the-website-in-azure-free)
  - [Step 2: Try it out](#step-2-try-it-out-free)
  - [Step 3: Invite people to the protected pages](#step-3-invite-people-to-the-protected-pages)
- [**Standard-tier walkthrough**](#standard-tier-walkthrough) &mdash; for group-based access
  - [Before you start](#before-you-start-standard)
  - [Step 1: Register a sign-in app in Microsoft Entra ID](#step-1-register-a-sign-in-app-in-microsoft-entra-id)
  - [Step 2: Find your security group's ID](#step-2-find-your-security-groups-id)
  - [Step 3: Create the website in Azure](#step-3-create-the-website-in-azure-standard)
  - [Step 4: Add the three secret values to the website](#step-4-add-the-three-secret-values-to-the-website)
  - [Step 5: Update one value in the config file](#step-5-update-one-value-in-the-config-file)
  - [Step 6: Try it out](#step-6-try-it-out-standard)
- [Troubleshooting sign-in](#troubleshooting-sign-in)
- [Plan limits at a glance](#plan-limits-at-a-glance)
- [Microsoft documentation](#microsoft-documentation)

---

## A few terms, in plain language

You'll see these words a lot. Here's roughly what they mean.

- **Azure Static Web Apps** &mdash; the Microsoft service that hosts the website. You give it a folder of files; it serves them on the internet.
- **Microsoft Entra ID** &mdash; Microsoft's identity service. The thing that knows who you are when you sign in with `you@company.com` or `you@outlook.com`. Used to be called Azure Active Directory.
- **Tenant** (also called **directory**) &mdash; your organization's space inside Microsoft Entra ID. Your personal Microsoft account lives in one tenant; your company has its own. Each tenant has a **Directory (tenant) ID**, a long string of letters and numbers.
- **App registration** &mdash; how you tell Microsoft "I have an app, and I'd like it to be able to sign people in." Produces an **Application (client) ID** and a **client secret** that your app uses to identify itself.
- **Security group** &mdash; a group of users in Entra ID. Each has a unique **Object ID**.
- **Role** &mdash; a permission tag. Our protected pages require the tag `boardmember`. How you grant that tag is what differs between the two examples.

---

## Free-tier walkthrough

### Before you start (Free)

You need:

1. A **GitHub account** with this repository (or a fork of it) under it.
2. An **Azure account**. A free one works fine. The Static Web App stays on the Free plan, which costs nothing.
3. A few **Microsoft accounts** to invite as test users (e.g. a personal `@outlook.com` and a couple of colleagues).

You do **not** need to register anything in Entra ID or know what a tenant is.

---

### Step 1: Create the website in Azure (Free)

1. Open [portal.azure.com](https://portal.azure.com) in your browser.
2. In the search bar at the top, type **Static Web Apps** and click the result.
3. Click **Create**.
4. Fill in the form:
   - **Subscription**: yours.
   - **Resource group**: create a new one if you don't have one (e.g. `swa-demo-rg`).
   - **Name**: anything (e.g. `contoso-annual-review-free`).
   - **Plan type**: **Free**.
   - **Region**: the closest one to you.
   - **Source**: **GitHub**. Click **Sign in with GitHub** if prompted.
   - **Organization / Repository / Branch**: this repo, on `main`.
   - **Build details &rarr; Build Presets**: **Custom**.
   - **App location**: `/free-tier/src` (this is the folder Azure should publish).
   - **Api location**: leave empty.
   - **Output location**: leave empty.
5. Click **Review + create**, then **Create**.

What happens next:

- Azure provisions the website and gives it a URL ending in `.azurestaticapps.net`.
- Azure adds a workflow file to your GitHub repo at `.github/workflows/azure-static-web-apps-*.yml`. This file is what tells GitHub to redeploy the site every time you push a change.
- The first deploy takes 1&ndash;3 minutes. You can watch it under the **GitHub Actions** tab of your repo.

When the deploy finishes, find your URL on the SWA's **Overview** blade in Azure and open it.

---

### Step 2: Try it out (Free)

1. Open the URL. The **Overview** page loads &mdash; that's the public landing page.
2. Click **Annual Report** in the navigation. You should be redirected to a Microsoft sign-in page.
3. Sign in with any Microsoft account you like.
4. After signing in, you'll see the **Access denied** page (`403.html`). That's correct! You're signed in but haven't been granted permission yet. That's what Step 3 is for.

> **Why does sign-in work for anyone but access doesn't?** The Free version uses Microsoft's built-in sign-in, which accepts any Microsoft account. Permission is separate &mdash; the protected pages require a specific tag (`boardmember`) on your account, and that tag has to be granted by you.

---

### Step 3: Invite people to the protected pages

1. In the Azure portal, open your Static Web App.
2. In the left-hand menu, under **Settings**, click **Role management**.
3. Click **+ Invite**.
4. Fill in the form:
   - **Authorization provider**: `aad` (this is the code for Microsoft sign-in).
   - **Invitee details**: the person's Microsoft account email (e.g. `friend@outlook.com` or `colleague@company.com`).
   - **Domain**: pick your `*.azurestaticapps.net` URL from the list.
   - **Role**: type exactly `boardmember`. Be precise &mdash; this is case-sensitive and must not have spaces around it.
   - **Maximum hours valid**: `168` (that's 7 days &mdash; the longest allowed). This is only the lifetime of the *invitation link*; once the person accepts, their access is permanent.
5. Click **Generate invitation link**.
6. Copy the link and email it to the person (or paste it into chat).

The recipient opens the link, signs in with the matching Microsoft account, and clicks Accept. From that moment on, they can read the **Annual Report** and **Strategy** pages whenever they visit the site (after signing in).

**To revoke someone's access later:** Role management &rarr; tick their row &rarr; **Delete**.

> **Heads-up: 25 people maximum.** This invitation system is capped at 25 invited users per site, on both Free and Standard plans. If you need more, the Standard-tier setup below lifts that limit by switching to group-based access.

---

## Standard-tier walkthrough

This setup is more involved, but once it's done you stop managing access on the website and start managing it via Microsoft Entra ID groups. Add a person to the group &rarr; they get in. Remove them &rarr; they're out. No invitation emails. No 25-person cap.

### Before you start (Standard)

You need:

1. A **Microsoft Entra ID tenant** with permission to register apps in it. If you're doing this in a company / org tenant, you may need an admin to either grant you the right or to do step 1 for you. (In the Entra admin centre, under **User settings**, the toggle is "Users can register applications".)
2. A **security group** in that tenant containing the people you want to grant access to. Create one in Entra ID &rarr; Groups if you don't have one.
3. An **Azure subscription** in the same tenant.

> **Personal account vs work account.** If you're putting the Free version in your personal Microsoft account and the Standard version in your company tenant, switch the Azure portal directory **before** doing any of the Standard steps. There's a directory switcher in the top-right corner of the portal (the gear/Settings icon or the directory name).

---

### Step 1: Register a sign-in app in Microsoft Entra ID

This tells Microsoft "I have an app, and I'd like it to be able to sign people in from this tenant."

1. In the Azure portal, switch to the right directory.
2. Search **Microsoft Entra ID** in the top bar, open it.
3. In the left menu, click **App registrations**, then **+ New registration**.
4. Fill in:
   - **Name**: anything descriptive (e.g. `contoso-annual-review-standard`).
   - **Supported account types**: **Accounts in this organizational directory only (single tenant)**. This is what restricts sign-in to your tenant only.
   - **Redirect URI**: choose **Web** and enter `https://placeholder.azurestaticapps.net/.auth/login/aad/callback`. You'll come back and fix the hostname after you create the website in Step 3.
5. Click **Register**.

You'll land on the **Overview** blade for the new app. Copy these two values somewhere &mdash; you'll need them later:

- **Application (client) ID**
- **Directory (tenant) ID**

Then:

6. In the left menu of this app registration, click **Certificates & secrets** &rarr; **+ New client secret**.
7. Enter a description (e.g. "SWA secret") and an expiry (e.g. 24 months). Click **Add**.
8. **Immediately copy the Value** column. You won't be able to see it again after you leave the page.

Then:

9. In the left menu, click **Authentication**. Scroll down to **Implicit grant and hybrid flows** and tick **ID tokens (used for implicit and hybrid flows)**. Click **Save** at the top.

   This one is easy to miss. Without it, sign-in fails with `AADSTS700054: response_type 'id_token' is not enabled for the application`. The SWA platform asks Microsoft for an ID token at sign-in, and Microsoft only issues those to apps that have explicitly opted in via this checkbox.

10. In the left menu, click **Token configuration** &rarr; **+ Add optional claim**.
11. Choose **ID** as the token type, tick **groups**, click **Add**. If a "Turn on the Microsoft Graph email, profile, openid permission" dialog pops up, accept it.
12. (If you see an extra dialog asking which type of group claim, choose **Security groups** or **All groups (including distribution lists)** depending on what makes sense for you.)

What you just did:

- Created an "identity" for your app inside your tenant.
- Generated a password (client secret) the website will use to prove it's the legitimate app.
- Asked Microsoft to include the list of groups the user is in inside their sign-in token. This is what makes group-based access possible.

> **If you have users in more than ~150 groups:** Microsoft omits the group list from the token (it would be too big) and replaces it with a pointer to fetch the list via the Microsoft Graph API. This sample does not implement that fallback. For small teams this is never an issue.

---

### Step 2: Find your security group's ID

1. In Microsoft Entra ID, click **Groups** in the left menu.
2. Click the group you want to use (e.g. `security-group-board-members`).
3. On the **Overview** blade, copy the **Object Id**. Long string, looks like a GUID.

---

### Step 3: Create the website in Azure (Standard)

Same flow as the Free version, with two changes: pick **Standard** plan and add the `api` folder.

1. [portal.azure.com](https://portal.azure.com) &rarr; search **Static Web Apps** &rarr; **Create**.
2. Fill in:
   - **Plan type**: **Standard**.
   - **Source**: **GitHub** &rarr; same repo &rarr; `main`.
   - **Build Presets**: **Custom**.
   - **App location**: `/standard-tier/src`.
   - **Api location**: `/standard-tier/api`. (This is new &mdash; it tells Azure to also deploy the little piece of code that decides who gets the `boardmember` tag.)
   - **Output location**: empty.
3. **Review + create** &rarr; **Create**.

When the SWA exists, you'll see its `.azurestaticapps.net` URL on the Overview blade. **Go back to your app registration from Step 1** and update the Redirect URI to use this real hostname instead of `placeholder.azurestaticapps.net`.

---

### Step 4: Add the three secret values to the website

The website needs to know three things at runtime. You'll add them as **application settings** on the SWA.

1. In your SWA resource, in the left menu, click **Environment variables** (some portal versions still call this **Configuration**).
2. Click **+ Add** and create each of these three settings:

| Setting name | Value to paste |
|---|---|
| `AZURE_CLIENT_ID` | The Application (client) ID from Step 1. |
| `AZURE_CLIENT_SECRET` | The client secret **Value** from Step 1 (the one you copied before leaving the page). |
| `BOARD_GROUP_ID` | The Object Id of your security group from Step 2. |

3. **Apply** / **Save**.

What these are for:

- The first two let the SWA's built-in sign-in flow talk to your app registration.
- The third is read by the small piece of code in `standard-tier/api/` that decides who gets the `boardmember` tag.

> **Treat the client secret like a password.** Don't commit it to the repo. Don't share it in chat. If it leaks, regenerate it from the app registration's Certificates & secrets blade.

---

### Step 5: Update one value in the config file

The file [`standard-tier/src/staticwebapp.config.json`](standard-tier/src/staticwebapp.config.json) currently has the placeholder text `<TENANT_ID>` in one place:

```jsonc
"openIdIssuer": "https://login.microsoftonline.com/<TENANT_ID>/v2.0"
```

Replace `<TENANT_ID>` with the **Directory (tenant) ID** you copied in Step 1, save the file, and push to GitHub. The example after editing should look like this (with your real tenant ID):

```jsonc
"openIdIssuer": "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000/v2.0"
```

The push triggers an automatic redeploy. After 1&ndash;2 minutes the change is live.

---

### Step 6: Try it out (Standard)

1. Open the Standard-tier site's URL. Look for the small orange **Standard tier** badge in the navigation &mdash; that's how you can tell which version you're looking at.
2. Click **Annual Report**. Sign in with a Microsoft account from your tenant.
3. If your account is a member of the security group you configured: you'll see the **Annual Report** page.
4. If your account is not in the group: you'll see the **Access denied** page (`403.html`).

To add a new person to the protected pages: add them to the security group in Entra ID. They'll have access the next time they sign in.

To remove someone: remove them from the group. They'll lose access the next time they sign in (or when their current session expires).

---

## Troubleshooting sign-in

These are the issues most people hit at some point. The single most useful tool is to open this URL directly in the browser:

```
https://<your-site>.azurestaticapps.net/.auth/me
```

It returns a small chunk of text (JSON) describing who the website thinks you are right now. `userRoles` is the list of permission tags on your active session. This is the **source of truth** &mdash; if your role isn't in `userRoles`, the protected pages won't load, regardless of what the Azure portal shows.

### "I gave myself the role but I still get Access denied"

The role list is read into your session when you sign in. If you were already signed in before the role was granted, your session is out of date.

**Fix:** Sign out *fully* and sign in again. Use the dropdown in the top-right corner of the site, or visit `https://<your-site>.azurestaticapps.net/.auth/logout` directly. An incognito/private window is the safest way to be sure you're getting a fresh session.

### "I refreshed `/.auth/me` and sometimes the role is there, sometimes it isn't"

This is **role propagation lag**. After you change a role, Microsoft's network of edge servers takes a few minutes to all see the same view. During that window, different page loads can return different answers.

**Fix:** Wait 5&ndash;15 minutes, then refresh `/.auth/me` a few times in a row in an incognito window. Once it consistently shows the role, you're done. It won't flip back.

### "The Azure portal says I have the role, but `/.auth/me` says I don't"

The portal can be ahead of what the platform actually applied. Trust `/.auth/me`.

**Fix:** In Role management, click your row and look at the exact text in the **Role** field. If `boardmember` isn't actually there (or is misspelled), fix it, save, then do a clean sign-out + sign-in.

### "The role looks right but it still doesn't work"

Role names are **case-sensitive** and **whitespace-sensitive**:
- `boardmember` &check;
- `BoardMember` &cross;
- `boardmember ` (trailing space) &cross;
- `board_member` &cross;

The role must match exactly between (1) what you typed into the invitation/portal and (2) what's in `staticwebapp.config.json`'s `allowedRoles`.

### "(Standard tier) Sign-in fails with AADSTS700054: response_type 'id_token' is not enabled"

You missed the **ID tokens** checkbox on the app registration.

**Fix:** Microsoft Entra ID &rarr; App registrations &rarr; your app &rarr; **Authentication** &rarr; scroll to **Implicit grant and hybrid flows** &rarr; tick **ID tokens** &rarr; **Save**. Try sign-in again in an incognito window.

### "(Standard tier) The website doesn't see my group membership"

Check:

1. Did you add `groups` as an optional claim in Step 1? Sign-out + sign-in after adding it.
2. Did you set `BOARD_GROUP_ID` to the **Object Id** of the group (not the group's name or email)?
3. Is your user actually in that group? Check in Entra ID &rarr; Groups &rarr; your group &rarr; Members.
4. Are you in more than 150 groups? See the note in Step 1 &mdash; this requires the Graph fallback, which this sample doesn't include.

### "`anonymous` and `authenticated` are in my `userRoles` &mdash; is that bad?"

No, that's normal. Every signed-in user automatically belongs to both. Your custom role (`boardmember`) should appear alongside them.

---

## Plan limits at a glance

The numbers below are from the official [Azure Static Web Apps quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas) page.

| What | Free | Standard |
|---|---|---|
| Bandwidth included per month | 100 GB | 100 GB |
| Extra bandwidth | Not available &mdash; site stops serving until next month | $0.20 per GB |
| Number of sites per subscription | 10 | 100 |
| Total storage per site | 500 MB | 2 GB |
| Storage per environment (a site can have multiple) | 250 MB | 500 MB |
| Custom domains per site | 2 | 6 |
| **People you can invite individually** | **25** | **25** |
| **People you can grant access to via the group-based approach** | Not available | Unlimited |
| SLA (uptime guarantee) | No | Yes |

Two things worth re-stating:

- The **25-person invitation cap is the same on Free and Standard**. Standard removes the cap only because it adds the group-based option (which this Standard example uses).
- The Free plan **never silently bills you**. If your site goes past 100 GB/month it stops serving until the month rolls over.

---

## Microsoft documentation

These are the official Microsoft pages this guide is based on. If something changes, these are the authoritative sources.

- [Quotas in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas) &mdash; the limits table.
- [Authenticate and authorize Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization) &mdash; the Free-tier sign-in system.
- [Custom authentication in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom) &mdash; the Standard-tier setup, including the role-assignment function.
- [Configuration (`staticwebapp.config.json`)](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration) &mdash; the full reference for the config file.
- [Assign roles via Microsoft Graph](https://learn.microsoft.com/en-us/azure/static-web-apps/assign-roles-microsoft-graph) &mdash; the advanced version of the role function, for users in >150 groups.
- [Pricing &mdash; Static Web Apps](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) &mdash; current Standard-plan cost.
