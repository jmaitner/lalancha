# La Lancha — Apps Script Backend (MVP)

The Google-side "brain" for La Lancha charters. Builds the Drive folders, the
master spreadsheet, and two Google Forms, then runs the day-to-day automation.
Waivers stay on **JotForm** (Google Forms can't do legal e-signatures); JotForm
reports signatures back here via the web-app endpoint.

## What it creates

```
Google Drive
└── La Lancha/
    ├── Charters/                     ← one auto-created folder per BOOKED charter
    │   └── 2026-07-04 — Maria (LL-20260704-A1B2)/
    │       ├── Fuel Policy (copy)
    │       └── General Info (copy)
    ├── Templates/                    ← Fuel Policy + General Info (edit these)
    ├── La Lancha — Operations  (Sheet)
    │   ├── Bookings
    │   ├── Leads                     ← every inquiry lands here
    │   ├── Guests                    ← signing roster (who's signed / who hasn't)
    │   └── Captains
    ├── La Lancha — Charter Inquiry   (Form → Leads)
    └── La Lancha — Captain Post-Charter Report (Form)
```

## Setup — run these in this order

**Do not build the Operations spreadsheet by hand.** Step 2 creates it, names its
tabs and sets the column order, and the code reads those columns *by position*.
A hand-made sheet will look right and silently write data into the wrong columns.

1. **Get the code in.** `cd apps-script && npx clasp push`, or paste `Code.gs`
   into script.google.com. Either way make sure `appsscript.json` matches the one
   in this repo — it carries the OAuth scopes, including `script.external_request`,
   without which Stripe invoicing fails at runtime.

2. **Run `setupLaLanchaSystem()`.** Authorize when Google prompts (it will warn
   about an unverified app; that is expected for a private script). This is
   idempotent, so it is safe on a system that already exists. It creates or
   reuses the Drive folders, the Operations sheet and its five tabs, the two
   Google Forms and the Quarters Charters calendar, mints the signing key for
   Luis's accept/decline links, adds the offer-flow columns, and installs every
   trigger. The execution log prints the links it made.

3. **Deploy ▸ New deployment ▸ Web app.** Execute as **me**, access
   **Anyone**. Copy the `/exec` URL.

4. **Paste that URL into `pinWebAppUrl()`, save, Run.** Skipping this is the
   classic failure: Luis's Accept and Decline buttons point at a stale
   deployment and silently do nothing. The function rejects anything that is not
   a real `/exec` URL and logs a sample link so you can eyeball it.

5. **Point the site at the same URL.** `ENDPOINT` in `site/src/config.ts`. A
   *new* deployment means a new URL; redeploying an existing one keeps it.

6. **Run `_testRequest()`.** You get the offer email exactly as Luis will,
   with live buttons. Tap Accept and follow it through. Then delete the test
   row from Bookings and its event from the calendar.

7. *(Optional)* **Automatic Stripe invoicing** — `pinStripeKey()`. Paste a
   **restricted** key (`rk_...`, write access to Customers, Invoices and Invoice
   Items only), Run, then delete it from the function and save. Leave it blank
   to keep billing by hand.

### If you are upgrading an existing system rather than building a new one

Step 2 covers it. If you would rather not re-run full setup, the minimum is
`migrateToOfferFlow()` (adds `GuestMessage` / `RespondedAt` / `InvoiceSent` and
the Status dropdown), then `installTriggers_()`, then steps 3–5.

## How the website / JotForm talk to it

POST JSON to the web-app URL:

```jsonc
// Astro: a charter was booked (after Stripe payment succeeds)
{ "action": "newBooking", "charterDate": "2026-07-04", "timeBlock": "afternoon",
  "primaryName": "Maria R.", "primaryEmail": "maria@x.com", "phone": "312...",
  "partySize": 6, "captainStatus": "need", "addOns": "Water toys, +1hr",
  "amountPaid": 1500, "stripeRef": "pi_123",
  "guests": [ { "name": "Guest 2", "email": "g2@x.com" } ] }

// Astro: someone made an inquiry (didn't book) → Leads sheet
{ "action": "newLead", "name": "Sam", "email": "sam@x.com",
  "phone": "...", "interest": "Sunset cruise in August" }

// JotForm webhook: a guest signed their waiver
{ "action": "waiverSigned", "bookingId": "LL-20260704-A1B2",
  "email": "g2@x.com", "signedPdfUrl": "https://..." }
```

## Triggers installed automatically
- Inquiry form submit → Leads sheet
- Captain report submit → emails Luis
- Daily 9am → "waivers still outstanding" digest to Luis

## Not in this MVP (next steps)
- Stripe hosted payment link generation (decided: handle later)
- Captain assignment is **manual** (booking pings Luis; he updates the sheet)
- Calendar availability / writing busy times out to the booking channels
- The Astro front-end itself
```
