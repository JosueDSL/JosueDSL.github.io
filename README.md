# josueds.me

Personal portfolio of **Josue de Santos** — backend software engineer. Built with [Astro 5](https://astro.build), deployed to GitHub Pages at [www.josueds.me](https://www.josueds.me).

## Stack & principles

- **Astro 5, static output** — content collections (Content Layer API) with zod-validated frontmatter. Bad content fails the build, not the reader.
- **Zero JavaScript frameworks** — the only client JS is a ~15-line theme toggle and a click-to-load YouTube facade, both vanilla `<script>`s. If a genuinely stateful island is ever needed, `@astrojs/react` is the sanctioned path — don't add it before then.
- **Vanilla CSS design system** — all tokens (colors, spacing, type scale, themes) live in [`src/styles/tokens.css`](src/styles/tokens.css). Dark is the default; light overrides via `[data-theme='light']`.
- **TypeScript strict** (`astro check` is the CI quality gate) + Prettier.

## Commands

| Command           | Action                         |
| ----------------- | ------------------------------ |
| `npm install`     | Install dependencies           |
| `npm run dev`     | Dev server at `localhost:4321` |
| `npm run build`   | Production build to `./dist/`  |
| `npm run preview` | Preview the production build   |
| `npm run check`   | Type-check (`astro check`)     |
| `npm run format`  | Format with Prettier           |

## Content authoring

All content is markdown/JSON in `src/content/`, validated by the schemas in [`src/content.config.ts`](src/content.config.ts).

### Add a project

Create `src/content/projects/<slug>.md`:

```markdown
---
title: 'Project name'
description: 'One-sentence summary shown on cards.'
stack: ['Python', 'PostgreSQL']
role: 'Backend Engineer'
links:
  repo: 'https://github.com/...' # optional
  live: 'https://...' # optional
featured: true # shows on the home page (max 3, ordered by `order`)
date: 2026-01-15
order: 1 # optional sort weight
---

Body in markdown: overview, architecture, impact.
```

### Add a blog post

Create `src/content/blog/<slug>.md`:

```markdown
---
title: 'Post title'
description: 'Shown in lists, RSS, and meta tags.'
pubDate: 2026-01-15
tags: ['backend', 'postgres']
draft: false # true hides it everywhere
---

Post body.
```

### Update the resume

Replace `public/static/media/resume.pdf` and push. The public URL `/static/media/resume.pdf` is stable — do not move it (it's linked from old resumes and external sites). `/resume` redirects to it.

## Deployment

Every push to `main` triggers [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): type-check → build → deploy to GitHub Pages. The custom domain is pinned by `public/CNAME`.

One-time repo setting: **Settings → Pages → Source → "GitHub Actions"**.
