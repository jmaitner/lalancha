import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static site — all dynamic behavior is client-side fetch to the Apps Script
// web app, so no server adapter is needed. Deploy the built /dist anywhere
// (Cloudflare Pages, Netlify, etc.).
// NOTE: `site` drives canonical URLs + sitemap. Both lanchaboats.com and
// lanchaboat.com resolve; lanchaboats.com is canonical (redirect the other to it).
export default defineConfig({
  site: 'https://lanchaboats.com',
  integrations: [sitemap()],
});
