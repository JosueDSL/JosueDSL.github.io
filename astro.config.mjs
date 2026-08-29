// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// User site on GitHub Pages with a custom domain: base stays '/'.
export default defineConfig({
  site: 'https://www.josueds.me',
  integrations: [sitemap()],
  redirects: {
    // Friendly alias; the canonical PDF path is stable at /static/media/resume.pdf.
    '/resume': '/static/media/resume.pdf',
  },
});
