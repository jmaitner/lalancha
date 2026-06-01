import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static site — all dynamic behavior is client-side fetch to the Apps Script
// web app, so no server adapter is needed. Deploy the built /dist anywhere
// (Cloudflare Pages, Netlify, etc.).
// NOTE: `site` drives canonical URLs + sitemap. Update if the canonical
// domain is lanchaboat.com instead of la-lancha.com.
export default defineConfig({
  site: 'https://la-lancha.com',
  integrations: [sitemap()],
});
