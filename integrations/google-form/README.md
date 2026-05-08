# Google Form ↔ GitHub Bridge (with Auto-Refresh)

One Apps Script that does **3 things**:

1. **`generateForm()`** — Creates a Google Form with one paragraph question
   per editable field in `content.json`. Run once.
2. **`doGet(e)`** — A Web App endpoint. When the editor opens the bookmarked
   URL, it fetches the latest `content.json`, builds a pre-fill URL with
   current values, and 302-redirects to the real Google Form. Editor always
   sees fresh content.
3. **`onFormSubmit(e)`** — Auto-fires on every form submission. Patches the
   matching paths in `content.json` on GitHub. GitHub Pages redeploys.

## Files

| File              | Purpose                                                          |
|-------------------|------------------------------------------------------------------|
| `setup.md`        | One-time setup walkthrough (≈15 min). Read first.                |
| `apps-script.gs`  | Single Apps Script file with all three functions.                |
| `form-fields.md`  | Reference of all generated questions and their JSON paths.       |

## Quick start

1. Generate a fine-grained GitHub PAT (Contents R/W on the repo).
2. New Apps Script project → paste `apps-script.gs` → save.
3. Add 4 Script Properties (`GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `CONTENT_PATH`).
4. Run `_testFetch` once → confirms GitHub access works.
5. Run `generateForm` once → creates form, attaches submit trigger, saves form ID.
6. **Deploy → New deployment → Web app** → copy the Web App URL.
7. Bookmark the Web App URL. Share with editors. Done.

Step-by-step in `setup.md`.

## Editor experience

- **One URL bookmarked forever.**
- Click → 1-second splash showing "Loading latest content…" → Google Form
  opens with all fields already filled with today's live content.
- Change what they need, leave the rest alone, submit.
- Site updates ~1 minute later.

## Architecture

```
Editor                       Google                                    GitHub
──────                       ──────                                    ──────
Opens bookmark ─► Apps Script doGet
                       │
                       │ GET content.json (current)
                       │◄──── current JSON
                       │
                       │ build pre-fill URL with all current values
                       │
                       │ 302 redirect ►
                                       │
Edits Google Form ◄──────────── pre-filled real Google Form
       │
       └─► submits
                ─► Apps Script onFormSubmit
                       │
                       │ patch only the changed fields
                       │
                       │ PUT content.json (with SHA)
                       │────► commit on main ──► GitHub Pages
                                                  auto-deploy
                                                       │
                                                       ▼
                                                 Live site updated (~1 min)
```

## Why this design

- **Real Google Form for editing.** Same UI, same Google security stack, same
  domain in the address bar (`docs.google.com`). The redirector is just a
  "find latest content + redirect" function — no custom UI to maintain.
- **One bookmark URL, fresh content every time.** Editor never has to ask
  "is this the current version?". Apps Script reads the live JSON every open.
- **PAT never reaches the browser.** It lives in Script Properties and only
  ever moves between Google's servers and GitHub's servers. The fine-grained
  PAT can only edit `content.json` on one repo.
- **Audit trail by default.** Each submit = a commit with the editor's email
  in the message. Revert with one GitHub click.
- **Re-runnable.** Add a new product or restructure → re-run `generateForm`,
  the Web App URL stays the same, no editor disruption.

## Coexists with the CSV layer

`cms/*.csv` + `cms/build.py` still works the same way for big restructuring
(adding a new product, a new section, etc.). Both paths converge on
`content/content.json`.
