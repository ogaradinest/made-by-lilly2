# Made by Lilly

Website for Made by Lilly, hand-crocheted shawls and oversized scarves.
Live at <https://ogaradinest.github.io/made-by-lilly2/>.

The site is plain static HTML, generated from simple content files by `build.mjs`
(Node.js, no dependencies). GitHub Actions runs the build and publishes to
GitHub Pages on every push to `main`, so **editing content only needs a commit**.

## Where things live

| What | File |
| --- | --- |
| Name, email, Instagram, Google Analytics ID, dispatch time | `content/site.json` |
| Products (name, price, description, photo, Stripe link) | `content/products.json` |
| Stock status: `"available"` or `"sold"` | `content/stock.json` |
| Journal posts | `content/blog/*.md` |
| Pattern guides | `content/pattern-guides/*.md` |
| Stitch library (technical details) | `content/technical-details/*.md` |
| Events | `content/events.json` |
| Photos | `static/images/` |
| Design | `static/css/site.css` |

## Common changes

**Mark a piece sold / available:** change its value in `content/stock.json`.
The product page swaps the Buy button for an "in the archive" note, and the
piece moves to the end of the shop. Also switch off the matching Stripe
Payment Link in Stripe, otherwise the direct link still takes payments.

**Add a product:** add an entry to `content/products.json`, a stock line to
`content/stock.json`, and photos to `static/images/` named `<name>-1536.jpg`
(large) and `<name>-768.jpg` (small). The file names without the size suffix go
in the product's `image` field. A product with no `stripe` link gets an
"Email to buy" button instead.

**Add a journal post:** add `content/blog/<url-slug>.md`:

```markdown
---
title: The post title
description: One or two sentences for Google and the post list (50+ characters, unique).
date: 2026-10-01
image: photo-name
alt: What the photo shows, in plain words
---

Opening paragraph.

## A subheading

More text. **Bold**, *italic*, [links](https://example.com) and - bullet lists work.
```

**Add an event:** add to `content/events.json` (past events hide automatically):

```json
[
  {
    "title": "Autumn Makers' Market",
    "date": "2026-10-18",
    "time": "10am to 4pm",
    "location": "Town Hall, High Street, Anytown",
    "agenda": "Browse the new winter pieces and try them on."
  }
]
```

**Turn on Google Analytics:** put the Measurement ID (`G-XXXXXXXXXX`) in
`ga4Id` in `content/site.json`. That switches on the cookie consent banner, the
"Cookie settings" footer link, and the analytics wording in the privacy and
cookie policies. Analytics never loads before a visitor clicks Accept.

## Preview locally

```bash
node build.mjs
node serve.mjs
```

Then open <http://localhost:4173/made-by-lilly2/>.

## Rules for this repo

- The repo is **public**. Never commit spreadsheets, costs, margins, supplier
  details, tokens or passwords. `.gitignore` blocks `.xlsx`, `.csv` and `.env`
  files as a safety net.
- Every page needs a unique title and meta description. The build fails if two
  pages share one, or if a description is under 50 characters.
- Every image needs descriptive alt text.

## Daily automations (planned)

- **Stock sync:** a scheduled Claude job reads Lilly's stock spreadsheet and
  writes only `"available"` / `"sold"` into `content/stock.json`, then commits.
- **Journal publishing:** a scheduled Claude job picks up new articles and
  photos from a folder on Lilly's PC, turns them into `content/blog/*.md` plus
  images in `static/images/`, commits, and moves the originals to `Published/`.

Both need the PC on, online and running the Claude desktop app when they fire.
