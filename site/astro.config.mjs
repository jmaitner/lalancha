import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Static site — all dynamic behavior is client-side fetch to the Apps Script
// web app, so no server adapter is needed. Deploy the built /dist anywhere
// (Cloudflare Pages, Netlify, etc.).
// NOTE: `site` drives canonical URLs + sitemap. lanchaboat.com is the live
// domain; lanchaboats.com (with an s) 301s to it in Cloudflare.
export default defineConfig({
  site: 'https://lanchaboat.com',
  integrations: [sitemap()],
});
