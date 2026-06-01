# lancha boat

Private boat charters aboard *Quarters* on Lake Michigan, Chicago. Marketing +
booking site and the Google-based operations backend.

## Structure

```
site/         Astro booking + marketing website (deploys to Cloudflare Workers)
apps-script/  Google Apps Script backend (bookings, leads, waivers, fuel, captain reports)
Assetts/      Raw source photos/video (LOCAL ONLY — gitignored; optimized copies live in site/public/images)
```

## Website (`site/`)

Astro static site. Booking + inquiry flows POST to the Apps Script web app;
live pricing is fetched per date. SEO destination pages under `/where-we-go/`.

```bash
cd site
npm install
npm run dev      # local dev at http://localhost:4321
npm run build    # outputs ./dist
```

### Deploy (Cloudflare Workers static assets)

Configured in `site/wrangler.jsonc` (`npx wrangler deploy` builds then uploads `./dist`).
For the Cloudflare GitHub integration, set **Root directory = `site`**.

## Backend (`apps-script/`)

Google Apps Script bound to the La Lancha Google Workspace. See
`apps-script/README.md` for setup and the web-app endpoint.
