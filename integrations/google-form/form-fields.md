# Form Field Reference

The Google Form is **auto-generated** by `generateForm()` in `apps-script.gs`.
You don't need to build it by hand — this doc just lists what gets created so
you know what to expect (and what JSON path each question writes to).

Every question is a Paragraph (long-text) input, optional, with the current
value shown as help text.

## Required header (collected for audit trail)

| Question Title  | Type          | Required |
|-----------------|---------------|----------|
| Editor Email    | Short answer  | ✅       |
| Change Note     | Short answer  | ❌       |

## Hero section (3 questions)

| Question Title         | JSON path           |
|------------------------|---------------------|
| Hero · Tagline         | `hero.tagline`      |
| Hero · CTA Primary     | `hero.ctaPrimary`   |
| Hero · CTA Secondary   | `hero.ctaSecondary` |

## Reliability stats (4 questions)

Only descriptions are editable here. Values like "99.999%" and labels like
"Uptime" are brand constants — managed in `cms/stats.csv`, not the form.

| Question Title                     | JSON path                                  |
|------------------------------------|--------------------------------------------|
| Stats · Uptime · Description       | `reliability.stats[label=Uptime].desc`     |
| Stats · Countries · Description    | `reliability.stats[label=Countries].desc`  |
| Stats · Delivery · Description     | `reliability.stats[label=Delivery].desc`   |
| Stats · Lifecycle · Description    | `reliability.stats[label=Lifecycle].desc`  |

## Portfolio products (18 questions = 9 × 2)

Each product has a tagline + description. Multi-paragraph descriptions:
separate paragraphs with **a blank line** (Enter twice).

| Question Title                                       | JSON path                                                |
|------------------------------------------------------|----------------------------------------------------------|
| Portfolio · SMS Platform · Tagline                   | `portfolios.items[label=SMS Platform].tagline`           |
| Portfolio · SMS Platform · Description               | `portfolios.items[label=SMS Platform].desc`              |
| Portfolio · Voice & SIP · Tagline                    | `portfolios.items[label=Voice & SIP].tagline`            |
| Portfolio · Voice & SIP · Description                | `portfolios.items[label=Voice & SIP].desc`               |
| Portfolio · Phone Numbers · Tagline                  | `portfolios.items[label=Phone Numbers].tagline`          |
| Portfolio · Phone Numbers · Description              | `portfolios.items[label=Phone Numbers].desc`             |
| Portfolio · Dolphlink Touch · Tagline                | `portfolios.items[label=Dolphlink Touch].tagline`        |
| Portfolio · Dolphlink Touch · Description            | `portfolios.items[label=Dolphlink Touch].desc`           |
| Portfolio · Dolphlink API · Tagline                  | `portfolios.items[label=Dolphlink API].tagline`          |
| Portfolio · Dolphlink API · Description              | `portfolios.items[label=Dolphlink API].desc`             |
| Portfolio · Dolphlink Smart · Tagline                | `portfolios.items[label=Dolphlink Smart].tagline`        |
| Portfolio · Dolphlink Smart · Description            | `portfolios.items[label=Dolphlink Smart].desc`           |
| Portfolio · Dolphlink Nexus · Tagline                | `portfolios.items[label=Dolphlink Nexus].tagline`        |
| Portfolio · Dolphlink Nexus · Description            | `portfolios.items[label=Dolphlink Nexus].desc`           |
| Portfolio · Operations Hub · Tagline                 | `portfolios.items[label=Operations Hub].tagline`         |
| Portfolio · Operations Hub · Description             | `portfolios.items[label=Operations Hub].desc`            |
| Portfolio · AI-Digital Solutions · Tagline           | `portfolios.items[label=AI-Digital Solutions].tagline`   |
| Portfolio · AI-Digital Solutions · Description       | `portfolios.items[label=AI-Digital Solutions].desc`      |

## Trust Layer (4 questions)

| Question Title                                | JSON path                                                    |
|-----------------------------------------------|--------------------------------------------------------------|
| Trust · Compliance Certified · Description    | `audit.items[title=Compliance Certified].desc`               |
| Trust · Data Sovereignty · Description        | `audit.items[title=Data Sovereignty].desc`                   |
| Trust · Verified Reliability · Description    | `audit.items[title=Verified Reliability].desc`               |
| Trust · Access Governance · Description       | `audit.items[title=Access Governance].desc`                  |

## Footer (2 questions)

| Question Title           | JSON path              |
|--------------------------|------------------------|
| Footer · Brand Tagline   | `footer.brandTagline`  |
| Footer · Mission Text    | `footer.missionText`   |

---

**Total: 33 questions** (Editor Email + Change Note + 31 content fields).

## What the form intentionally excludes

Form is for day-to-day copy edits. Things that change rarely live in the
CSV layer (`cms/*.csv`):

- Brand name, nav menu items, navigation labels
- Stat values (99.999% etc.) — brand constants
- Industry sector colors and labels
- Map location coordinates
- Footer address, email, copyright string
- Static UI strings (FEATURE PRESENTATION, OUR DOCTRINE, etc.)

To change those: edit the relevant CSV → run `python cms/build.py`.

## Adding a new field to the form later

Just add it to `content.json` (or via CSV → build.py). Then re-run
`generateForm()` in Apps Script. The new field will appear as a question
in the regenerated form, and `buildFieldMap()` (which reads the live JSON)
will route submissions correctly without any code changes.

For totally new array structures, you may need to edit `buildFieldMap()` to
add the iteration logic. See the function in `apps-script.gs`.
