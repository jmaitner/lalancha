# La Lancha — Notices (standalone Apps Script)

Chicago "Notice to Mariners" backend. **Completely separate from the booking/checkout
Apps Script project** — its own project, its own web-app URL, its own trigger, its own
Google Sheet. Deploying this can never touch checkout.

- `Notices.gs` — the whole thing: fetch USCG RSS → Chicago-only filter → dedupe →
  30-day retention → cancellations → `needs_review` → serves JSON at `?action=notices`.
- `appsscript.json` — scopes + public web-app config.

## One-time setup

```bash
cd apps-script-notices
npx clasp login          # sign in (owns this project + its sheet)
npx clasp create --type webapp --title "La Lancha Notices"   # NEW project, separate from booking
npx clasp push
```

> If `clasp create` overwrites `appsscript.json` with a default, restore the one in
> this folder (it has the RSS-fetch + sheet + trigger scopes and the public web-app config),
> then `npx clasp push` again.

Then in the Apps Script editor (script.google.com → **La Lancha Notices**):

1. Run **`setupNotices`** once → **authorize** when prompted. It creates the
   "La Lancha — Notices" sheet, installs a 15-minute trigger, and backfills.
2. **Deploy → New deployment → Web app** → *Execute as: Me*, *Who has access: Anyone* →
   **Deploy**, and copy the **/exec URL**.

Send that `/exec` URL back — it goes in `site/src/config.ts` as `NOTICES_ENDPOINT`, and
the `/notices` page reads only that URL.

## Verify
- `<exec-url>?action=notices` returns `{ ok: true, updated, count, notices: [...] }`.
- The Notices sheet fills with Chicago BNM rows (`chicagoRelevant = TRUE`).
- A failed fetch never wipes the sheet (the store is only written on a successful fetch).

## Tuning (later)
All Chicago include/exclude rules live in the `NOTICES_CFG` block at the top of
`Notices.gs`. `needs_review` rows in the sheet show what the filter was unsure about.
