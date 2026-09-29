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

## How it works (data flow) — OFFER FLOW
Nothing is confirmed until Luis says yes. He gets every charter as an offer he accepts or declines.

1. Customer requests on the site → the site POSTs `newRequest` to the Apps Script web-app endpoint (and GETs `?action=pricing&date=` for live price + availability). `newBooking` is the legacy name and maps to the same place, so a cached old page can't auto-confirm.
2. `createRequest`: race-guards against the **Quarters Charters** calendar → pencils in a **pending hold** (event titled `⏳ REQUEST — …`, guest NOT invited) → logs a Bookings row with `Status: Requested` → emails Luis **the offer** (price they booked at, their message, Accept/Decline buttons, reply-to = the guest) → sends the guest a "we got it, nothing charged" ack.
3. Luis taps **Accept** or **Decline** in that email (`doGet ?action=accept|decline&id=&t=`). The `t` is an HMAC token — `doGet` is public, so without it anyone could confirm or kill charters by guessing an ID. Backup path: the **Status** dropdown in the Bookings sheet (`onBookingsEdit`).
   - **Accept** → Drive folder, calendar event promoted + guest invited, guest confirmation email, and Luis gets an "invoice $X" reminder. **Luis invoices manually** (Stripe dashboard).
   - **Decline** → hold deleted (slot reopens), guest let down gently.
4. **Holds never expire.** A website lead pays more than the other channels, so Luis holds the slot until he personally declines. `nudgeOpenRequests` (hourly) reminds him at `NUDGE_HOURS` (12) then every `NUDGE_REPEAT_HOURS` (24) until he answers — that reminder is the only thing stopping a forgotten request from blocking the boat forever.
5. **Waivers are signed at the dock.** No pre-trip waiver emails. `recordWaiverSigned` upserts guests who weren't pre-entered, so the roster fills itself as people sign.
6. **Charter agreement** is emailed automatically on acceptance and chased by `agreementReminders` (daily, capped at `AGREEMENT_NUDGE_MAX`). Both are silent until `LINK_AGREEMENT_NOPAY` is set, since the pay-bundled form must never reach a guest. `reconcileJotform` (every 10 min) stamps **AgreementSigned**, which stops the chase. It no longer writes Status or Paid — Luis owns both.
   - **Stripe invoicing** is automatic when a restricted key is stored in Script Properties as `STRIPE_SECRET_KEY`. `createStripeInvoice_` finds-or-creates the customer, creates the invoice with `pending_invoice_items_behavior: exclude`, attaches the line to that invoice by id, and finalizes. `STRIPE_AUTO_SEND` decides whether it also emails the guest. **A Stripe failure never blocks a charter** — it degrades to "invoice by hand". No key at all = fully manual, which is what Luis uses if he bills through his bank to avoid card fees.
7. Captain fills the **Captain Post-Charter Report** (Google Form) → `onCaptainFormSubmit` sets fuel (flat $50 per charter) → writes it to the booking + emails Luis what to invoice.
8. **Experiences** (`/experiences`: architecture tour, sunset cruise, Soldier Field shuttle, relocation) POST `newExperienceRequest` → `createExperienceRequest`, which rides the same offer flow (Bookings row with the `Experience` column filled, Accept/Decline, nudges, invoice). Prices come from the **Experiences** tab (`?action=experiences&date=`) and are recomputed server-side. Holds are the exact trip window; a round-trip shuttle holds two (comma-separated `EventId`); relocation holds nothing. Fuel is included (captain report bills $0), and the bareboat agreement chase skips them.
9. Daily triggers: unpaid digest (9am, accepted charters with a blank Paid column), Google-review request to finished charters (10am).

## Key files
- `apps-script/Code.gs` — the entire backend. CONFIG block at top holds all IDs/links/prices. `setupLaLanchaSystem()` bootstraps everything (idempotent). Offer flow, reconcile, calendar, reviews, fuel, forms all here.
  - Offer flow: `createRequest` / `acceptRequest` / `declineRequest` / `nudgeOpenRequests`, `handleDecision_` + `token_` (signed links), `onBookingsEdit` (sheet backup), `migrateToOfferFlow()` (adds the new columns to a live sheet), `_testRequest()` (sends yourself a real offer email).
  - Money & paperwork: `createStripeInvoice_` / `stripe_` / `stripeGet_` / `setStripeKey`, `agreementReminders`, `unpaidDigest`.
- `apps-script/README.md` — backend setup.
- `site/src/config.ts` — endpoint URL, time blocks, default price.
- `site/src/destinations.ts` — the "where we go" destination content.
- `site/src/layouts/Base.astro` — shared layout, brand theme, SEO meta, OG tags.
- `site/src/pages/` — index, book, where-we-go, 404.
- `HANDOFF.md` — plain-English handoff brief for Luis.

## Common changes
- **Change the standard price**: `DEFAULT_BLOCK_PRICE` in both `apps-script/Code.gs` CONFIG and `site/src/config.ts`. Premium per-date prices: the **Pricing** tab in the Operations sheet.
- **Change experience prices**: the **Experiences** tab in the Operations sheet (Price, PeakPrice on PeakDays, Hours, MaxGuests, Active). Card copy: `site/src/experiences.ts`. New experience = row in the tab + entry in `CONFIG.EXPERIENCES` + card in experiences.ts, same ID in all three.
- **Change reminder cadence**: `NUDGE_HOURS` / `NUDGE_REPEAT_HOURS` (Luis) and `AGREEMENT_NUDGE_HOURS` / `AGREEMENT_NUDGE_MAX` (guests) in CONFIG. Holds themselves are deliberately permanent.
- **Turn on automatic Stripe invoices**: store a restricted key via `setStripeKey('rk_live_…')`, then clear the argument. `STRIPE_AUTO_SEND: true` also emails it to the guest.
- **Edit the offer email Luis gets**: `sendOfferToLuis_`. The accepted-charter email: `sendAcceptedEmail_`.
- **Change time blocks**: `TIME_BLOCKS` + `BLOCK_WINDOWS` in Code.gs CONFIG (and `BLOCKS` in site config.ts).
- **Brand colors/fonts**: `:root` vars in `site/src/layouts/Base.astro`.
- After editing Code.gs: `cd apps-script && npx clasp push && npx clasp create-deployment` (or redeploy the existing deployment id). **Bump `CONFIG.CODE_VERSION` and redeploy** — the editor runs HEAD while `/exec` serves the last *deployed* version, so pasting code without redeploying leaves guests on the old one. `checkSetup()` asks the live deployment for its version and flags the drift. After editing the site: `cd site && npm run build`, commit, push (Cloudflare redeploys).

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
- **Accept/Decline links need the deployed URL.** `CONFIG.WEBAPP_EXEC_URL` carries it, and must match `ENDPOINT` in `site/src/config.ts`. A *new* deployment mints a new URL; updating the existing one keeps it. Get this wrong and the buttons fail silently and only for other people — the script owner's own tests still pass, because `ScriptApp.getService().getUrl()` returns a working /dev URL from the editor. `checkSetup()` is the standing check for it.
- **`CONFIG.LINK_AGREEMENT` still bundles Stripe payment.** It must NOT go to guests under the offer flow. The accepted-charter email only links an agreement once `LINK_AGREEMENT_NOPAY` (a payment-free clone of the JotForm) is filled in; until then it omits it.
- **Bookings column order is positional.** `appendRow_`/`updateBooking_` map `HEADERS.Bookings` by index against the live sheet, so only ever add new columns at the END, then run `migrateToOfferFlow()`.
