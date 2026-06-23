# CLAUDE.md — lancha boat project

Context for any Claude session working on this repo. Read this first.

## What this is
A booking + operations system for **La Lancha** (brand: "lancha boat"), a private
boat-charter business in Chicago running one boat, **Quarters**, out of Diversey
Harbor (K-Dock, Slip 8). Owner/operator: **Luis Vecchio**.

It's two parts:
- `site/` — the public **Astro** website (marketing + booking flow). Deploys to **Cloudflare Workers** (static assets). Set Cloudflare **Root directory = `site`**, build `npm run build`, deploy `npx wrangler deploy`.
- `apps-script/` — the **Google Apps Script** backend ("the brain"). Runs as **lalanchacharters@gmail.com**. Deployed as a web app via `clasp`.

Raw source photos are in `Assetts/` (gitignored, local only); optimized web copies live in `site/public/images/`.

## How it works (data flow)
1. Customer books on the site → the site POSTs `newBooking` to the Apps Script web-app endpoint (and GETs `?action=pricing&date=` for live price + availability).
2. Apps Script (`createBooking`): checks the **Quarters Charters** Google Calendar for a free slot (race guard) → creates a calendar event (auto-confirm) → makes a Drive folder → logs the **Bookings** row → seeds the **Guests** roster → emails the guest (Luis's onboarding template w/ prefilled JotForm links) → emails Luis.
3. Customer signs **JotForm Charter Agreement** (`260923725423052`) + **pays via Stripe** (User Defined Amount, prefilled from the booking link). Guests sign **JotForm Waiver** (`261307203350039`).
4. JotForm → Google Sheets (native integration). A timer (`reconcileJotform`, every 10 min) reads those sheets and stamps **Paid / AgreementSigned / WaiverSigned** onto Bookings/Guests, and alerts on amount mismatches.
5. Captain fills the **Captain Post-Charter Report** (Google Form) → `onCaptainFormSubmit` sets fuel (flat $50 per charter) → writes it to the booking + emails Luis what to invoice.
6. Daily triggers: waiver-reminder digest (9am), Google-review request to finished charters (10am).

## Key files
- `apps-script/Code.gs` — the entire backend. CONFIG block at top holds all IDs/links/prices. `setupLaLanchaSystem()` bootstraps everything (idempotent). Reconcile, calendar, reviews, fuel, forms all here.
- `apps-script/README.md` — backend setup.
- `site/src/config.ts` — endpoint URL, time blocks, default price.
- `site/src/destinations.ts` — the "where we go" destination content.
- `site/src/layouts/Base.astro` — shared layout, brand theme, SEO meta, OG tags.
- `site/src/pages/` — index, book, where-we-go, 404.
- `HANDOFF.md` — plain-English handoff brief for Luis.

## Common changes
- **Change the standard price**: `DEFAULT_BLOCK_PRICE` in both `apps-script/Code.gs` CONFIG and `site/src/config.ts`. Premium per-date prices: the **Pricing** tab in the Operations sheet.
- **Edit the confirmation email**: `sendBookingConfirmation_` in Code.gs.
- **Change time blocks**: `TIME_BLOCKS` + `BLOCK_WINDOWS` in Code.gs CONFIG (and `BLOCKS` in site config.ts).
- **Brand colors/fonts**: `:root` vars in `site/src/layouts/Base.astro`.
- After editing Code.gs: `cd apps-script && npx clasp push && npx clasp create-deployment` (or redeploy the existing deployment id). After editing the site: `cd site && npm run build`, commit, push (Cloudflare redeploys).

## External pieces (live)
- Google Workspace on lalanchacharters@gmail.com: Operations sheet, "Quarters Charters" calendar, Drive folders, 2 Google Forms.
- JotForm: Charter Agreement + 2026 Waiver, each connected to a Google Sheet (IDs in CONFIG: AGREEMENT_SHEET_ID / WAIVER_SHEET_ID). Stripe ("LaLancha Strip", LIVE) on the agreement.
- Stripe live.

## Gotchas
- Other booking platforms (Boatsetter/GetMyBoat/Sailo/Playpen) don't auto-sync — Luis manually blocks those dates by adding events to the Quarters Charters calendar.
- JotForm's Google Sheets integration only captures fields that existed when connected — adding a field later requires reconnecting the integration.
- Apps Script web-app POST returns a 302 redirect; for browser `fetch` send `Content-Type: text/plain` to avoid a CORS preflight.
- Canonical/OG/sitemap URLs use `la-lancha.com` as a placeholder — change `site` in `site/astro.config.mjs` once the real domain (lanchaboat.com vs la-lancha.com) is chosen.
- `clasp create-script` overwrites `appsscript.json` with a default — keep the real manifest (full scopes + webapp config).
