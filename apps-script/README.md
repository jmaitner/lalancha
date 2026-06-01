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

## Setup (10 min)

1. Go to **script.google.com → New project**. Paste `Code.gs`. (Optional: in
   Project Settings, enable the manifest and paste `appsscript.json`.)
2. Edit the **CONFIG** block at the top: set `OWNER_EMAIL` to Luis's email and
   `FUEL_HOURLY_RATE`.
3. Run **`setupLaLanchaSystem`** once. Authorize when prompted. Check the
   execution log for the links to the new sheet + forms.
4. Run **`_testBooking`** to fire a full end-to-end booking (folder + rows +
   emails). Delete the test row/folder after.
5. **Deploy ▸ New deployment ▸ Web app** → copy the `/exec` URL. This is the
   endpoint Astro and JotForm will POST to.

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
