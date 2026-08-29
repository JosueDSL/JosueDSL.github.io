---
title: 'Rebuilding my portfolio with Astro'
description: 'Why I rebuilt this site from hand-written HTML to Astro 5 — and the engineering decisions behind a site that ships zero JavaScript frameworks.'
pubDate: 2026-08-29
tags: ['astro', 'meta', 'web']
draft: false
---

The first version of this site was a handful of hand-written HTML files I put together while looking for my first job. It served its purpose, but three years of professional backend work later, it no longer represented how I build software.

This rebuild is intentionally minimal in what it ships and deliberate in how it's structured:

- **Astro 5 with content collections** — every project and post is a markdown file validated against a zod schema at build time. Bad frontmatter fails the build, not the reader.
- **Zero JavaScript frameworks** — the theme toggle and lazy video embeds are a few lines of vanilla script. The fastest dependency is the one you don't install.
- **Design tokens over a CSS framework** — the entire visual system lives in one tokens file with dark/light themes driven by custom properties.
- **CI-deployed** — GitHub Actions builds and deploys to GitHub Pages on every push, with type-checking as the quality gate.

More posts on backend engineering coming soon.
