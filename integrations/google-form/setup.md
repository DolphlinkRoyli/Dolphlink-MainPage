# Google Form ↔ GitHub Bridge — Setup Guide

This integration gives you a **bookmark URL** that always opens a real Google
Form pre-filled with the latest content.json. Editor edits, submits, and the
change goes live in ~1 minute.

## Architecture

```
Editor opens bookmark URL
    │
    ▼  (HTTPS)
Apps Script Web App  doGet()
    │
    │ fetch GitHub: read latest content.json
    │ build pre-fill URL using current values + form item IDs
    │
    ▼  (302 redirect)
Real Google Form (docs.google.com)
    │  ← Editor sees current values pre-filled, edits, submits
    ▼
Apps Script onFormSubmit()
    │
    │ patch GitHub: only fields the editor changed
    │
    ▼
GitHub Pages auto-deploys
```

The form is a **real Google Form** (Google domain, Google UI, all of Google's
spam/security stack). The Web App is just a 5-line redirector.

---

## One-time setup (≈15 minutes)

### 1. Generate a fine-grained GitHub Personal Access Token

Already done? Skip to step 2.

1. https://github.com/settings/personal-access-tokens/new
2. **Token name**: `DOLPHLINK Form Bridge`
3. **Resource owner**: your account (`dolphlinkroyli`)
4. **Expiration**: 1 year
5. **Repository access** → **Only select repositories** → pick
   `Dolphlink-MainPage` only.
6. **Repository permissions**: `Contents` → **Read and write**. Leave
   everything else at "No access".
7. **Generate token** → copy it (`github_pat_…`).

### 2. Create a new Apps Script project

1. https://script.google.com → **New project**.
2. Name it `DOLPHLINK Content Bridge`.
3. Replace the empty `Code.gs` with the **entire content of
   `apps-script.gs`** from this folder. Save (Ctrl+S).

### 3. Add Script Properties (secrets + access control)

1. Apps Script left sidebar → gear icon (**Project Settings**).
2. Scroll to **Script properties** → **Edit script properties**.
3. Add **five** properties:

   | Property            | Value                                                      |
   |---------------------|------------------------------------------------------------|
   | `GITHUB_TOKEN`      | (paste the PAT from step 1)                                |
   | `GITHUB_OWNER`      | `dolphlinkroyli`                                           |
   | `GITHUB_REPO`       | `Dolphlink-MainPage`                                       |
   | `CONTENT_PATH`      | `content/content.json`                                     |
   | `EDITOR_ALLOWLIST`  | `you@gmail.com, joyce@dolphlink.com, sales@dolphlink.com`  |

4. **Save script properties**.

> ⭐ **`EDITOR_ALLOWLIST` is the security key.** Comma-separated list of Google
> emails permitted to use the editor. Even if the Web App URL leaks publicly,
> only these specific Gmail / Workspace accounts can actually open it or
> commit. Visitors with other Google accounts see an "Access denied" page.
> Edit this property anytime to add/remove editors — no redeploy needed.

### 4. Test the GitHub connection + allowlist

1. Function dropdown → `_testFetch` → **Run**.
2. Authorize when prompted (Connect to external service → Allow).
3. **Execution log** should show `OK — fetched 15813 bytes, SHA = …`.
   - HTTP 401 = wrong PAT, regenerate.
   - HTTP 404 = wrong owner/repo/path in Script Properties.
4. Function dropdown → `_testAllowlist` → **Run**.
5. Log should show your email and `Authorized: true`. If `false`, fix the
   `EDITOR_ALLOWLIST` Script Property to include your email.

### 5. Generate the form

1. Function dropdown → `generateForm` → **Run**.
2. Authorize again (View/manage forms → Allow).
3. Wait ~10 seconds. Check Execution log — should print:
   ```
   FORM CREATED
   Form Edit URL:    …
   Form Public URL:  …
   Form ID saved to Script Properties: FORM_ID
   On-submit trigger attached.
   NEXT STEP: Deploy → New deployment → Type: Web app
   ```

### 6. Deploy as Web App ⭐ (this is the redirector)

1. In Apps Script: top-right **Deploy** → **New deployment**.
2. **Select type** (gear icon) → **Web app**.
3. Configure:
   - **Description**: `DOLPHLINK Editor v1`
   - **Execute as**: **Me** (so the script runs with YOUR Google account, which
     is what gives it permission to read GitHub via the stored PAT)
   - **Who has access**: choose one:
     - **Anyone with Google account** — anyone signed into Google can open the
       URL (you control distribution by sharing the URL only with editors)
     - **Only myself** — locks it to your Google account
     - If you have Google Workspace: pick your specific organization
4. Click **Deploy**.
5. Authorize one more time if prompted.
6. **Copy the Web App URL** (long string starting with
   `https://script.google.com/macros/s/.../exec`).

This URL is the **bookmark for editors**.

### 7. Smoke test

1. Open the Web App URL in a new browser tab.
2. You should see a "Loading latest content from GitHub…" splash for ~1 second,
   then redirect to a Google Form.
3. The form fields should be **pre-filled with the current content.json values**.
4. Fill in:
   - Editor Email: your email
   - Change Note: `setup test`
   - Hero · Tagline: append `(test)` to the existing text.
5. Submit.
6. Within ~10 seconds: a new commit appears on
   https://github.com/dolphlinkroyli/Dolphlink-MainPage/commits/main
   with message `Content update (1 field) via Form by your@email.com: setup test`.
7. After ~1 minute: https://dolphlinkroyli.github.io/Dolphlink-MainPage/ shows
   the updated tagline.
8. Open the Web App URL again — the form should now show the **updated**
   tagline pre-filled (proving the auto-refresh works).
9. Fix the tagline back to original via the form, or revert via the GitHub
   commit's "Revert" button.

---

## Daily editor workflow

1. Open the bookmark (Web App URL).
2. ~1 second loading splash → Google Form opens with all fields **already showing
   today's live content**.
3. Edit only the field(s) that need to change. Leave the rest alone.
4. Multi-paragraph descriptions: separate paragraphs with **a blank line**
   (Enter twice). The frontend renders each paragraph as its own `<p>`.
5. Submit. Refresh the live site after ~1 minute.

Avoid `\` (backslash) and unescaped `"` (straight double quote) in field values
— they're special in JSON. Use smart quotes `"…"` / `'…'` instead.

---

## What if I add a new product / restructure content?

Just update `content.json` (via the CSV pipeline or directly), then
**re-run `generateForm`** in Apps Script. It rebuilds the form with the new
fields. The Web App URL stays the same — editors keep their bookmark.

---

## Troubleshooting

| Symptom                                          | Cause / fix                                                                  |
|--------------------------------------------------|------------------------------------------------------------------------------|
| `_testFetch` says HTTP 401                       | PAT wrong/expired. Regenerate (step 1) and update `GITHUB_TOKEN`.            |
| `_testFetch` says HTTP 404                       | Wrong owner/repo/path. Verify Script Properties.                             |
| Web App URL shows "Form not yet generated"       | You haven't run `generateForm` yet. Run it, then re-deploy the Web App.      |
| Web App URL doesn't redirect                     | Browser blocked JS. Click the "Click here" fallback link.                    |
| Form opens but fields are EMPTY                  | Form was created but pre-fill failed. Check Apps Script → Executions tab.    |
| Submit silent, no commit                         | Apps Script → Executions → look at `onFormSubmit` run → see error message.   |
| HTTP 409 / SHA conflict on submit                | Someone committed to `main` between fetch and push. Re-submit the form.      |
| Site not updating after commit                   | GitHub Pages takes 30-90 seconds. Hard-refresh (Ctrl+Shift+R).               |
| Need to update the script                        | Edit Code.gs, Save. **Then Deploy → Manage deployments → edit (pencil) → New version → Deploy.** Otherwise old code keeps running. |

---

## Security model (defense in depth)

The editor URL is treated as **public** — it can leak via shared docs, browser
history, support tickets, etc. Three independent layers protect content:

1. **Google sign-in required** (Web App deployed as "Anyone with Google
   account") — anonymous visitors can't even reach `doGet`.
2. **Email allowlist** (`EDITOR_ALLOWLIST` Script Property) — `doGet` checks
   `Session.getActiveUser().getEmail()` against the list. Visitors with any
   non-listed Google account see an "Access denied" page and never see the
   pre-filled URL or the form. The check repeats inside `onFormSubmit`, so
   even if someone bookmarked a pre-fill URL they can't commit.
3. **Email pre-filled, locked** — the `Editor Email` field is automatically
   filled with the verified Google account email. The submitter can't pretend
   to be someone else in the commit message.

Plus the existing safeguards:
- **PAT scope**: Fine-grained, locked to ONE repo, Contents permission only.
  Worst-case blast radius is `content.json` on this one repo, fully recoverable
  via `git revert`.
- **PAT location**: Apps Script Script Properties (encrypted at rest, never
  ships to browsers / logs / commits).
- **Audit trail**: every commit signed with the editor's verified email.
  GitHub UI shows full history + 1-click revert.

### Adding / removing an editor

Edit the `EDITOR_ALLOWLIST` Script Property — comma-separated. Effect is
immediate, no redeploy needed. Removing someone instantly revokes their
access on the next request.

### What "Anyone with Google account" deployment really means

It controls who can *connect* to the Web App URL. It does NOT mean anyone with
a Gmail can edit your site — the allowlist enforces that. If you also have
Google Workspace, you can additionally restrict the deployment to your
organization for a 4th layer of defense.
