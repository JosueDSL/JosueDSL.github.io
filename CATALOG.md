# 3D-print catalog (`/catalogo/`)

The catalog page is a showcase of models I print on order. It is built from:

| File                          | Who edits it                    | What it is                                   |
| ----------------------------- | ------------------------------- | -------------------------------------------- |
| `catalog/config.yml`          | **You**                         | Collections, model lists, overrides, contact |
| `catalog/data.generated.json` | The sync script — never by hand | Model names, descriptions, designers, images |
| `public/catalogo/img/`        | The sync script — never by hand | WebP images (600px thumbnail, 1200px full)   |
| `public/catalogo/og.jpg`      | The sync script — never by hand | Link-preview image for WhatsApp / social     |

The page only reads the committed files, so it keeps working even if MakerWorld is down or the sync breaks.

## How the sync works (and why you list models by hand)

MakerWorld protects its collection pages and collection API with a Cloudflare challenge, so a script can't read which models are in a collection. Model detail pages are open, though. So:

- **You** list each collection's model URLs (or IDs) in `config.yml`.
- **The sync** fetches each model's title, description, designer and images from MakerWorld, converts the images to WebP, applies your overrides and writes `data.generated.json`.

## Collections

Each entry under `collections:` is one section on the page, **in the same order as the file**.

```yaml
collections:
  - url: https://makerworld.com/en/collections/36227751-organizers # reference only
    name: Organizadores # section title (Spanish, required)
    description: Texto opcional bajo el título.
    models:
      - https://makerworld.com/en/models/879360-magnet-organizer # a full URL works
      - 1414160 # EDC Tape Card   ← or just the ID; comments are ignored
```

- **Add a collection**: copy an entry, set `name` and paste its model URLs under `models`.
- **Remove a collection**: delete (or comment out with `#`) its entry. Its models' images are deleted on the next sync unless they're also in another collection.
- **Reorder collections**: move entries up or down. **Reorder models**: move lines within `models`.
- **Add a model**: paste its MakerWorld URL as a new line under `models`. A model can be listed in several collections; its images are downloaded only once.

### Getting a collection's model URLs quickly

Open the collection on makerworld.com in your browser (logged in, so private collections work), open the developer console (⌥⌘J in Chrome) and paste this. It fetches every page of the collection and copies a ready-to-paste `models:` list to your clipboard:

```js
(async () => {
  const id = location.pathname.match(/collections\/(\d+)/)[1];
  const lines = [];
  for (let offset = 0; ; offset += 20) {
    const r = await fetch(`/api/v1/design-service/favorites/${id}/designs?offset=${offset}&limit=20`);
    const { hits, total } = await r.json();
    hits.forEach((h) => lines.push(`      - ${h.id} # ${h.title.replace(/\s+/g, ' ').trim()}`));
    if (!hits.length || lines.length >= total) break;
  }
  copy(lines.join('\n'));
  console.log(`Copied ${lines.length} models`);
})();
```

## Overrides: rename, translate or hide a model

The model ID is the number in its URL: `https://makerworld.com/en/models/`**`1791243`**`-mini-crossbow`. It's also the `#m-…` part of the catalog deep link.

```yaml
overrides:
  1791243:
    name: Mini ballesta # replaces the MakerWorld title
    description: Ballesta pequeña totalmente impresa. # replaces the description
  2741715:
    hidden: true # not shown anywhere on the page
```

Titles and descriptions are never auto-translated: without an override, the page shows MakerWorld's original text. Renaming never breaks links, because deep links use the ID.

## Contact: WhatsApp, email and messages

Everything is under `contact:` in `config.yml`: `whatsapp` (digits only, with country code, e.g. `52…`), `email`, and the message templates. In the templates, `{name}` becomes the model name and `{link}` its deep link (`https://www.josueds.me/catalogo/#m-<id>`).

Contact changes don't need a sync: they're applied on the next deploy (any push to `main`).

## Running the sync

**From GitHub** (no setup): **Actions → Sync catalog → Run workflow**. It syncs, commits the changes to `main`, and redeploys the site. Tick _allow_shrink_ if you intentionally removed more than 30% of the models.

**Locally**:

```bash
npm run catalog:sync
git add catalog public/catalogo && git commit -m "chore(catalog): sync" && git push
```

The push deploys the site as usual. The first full sync takes about an hour (it's deliberately slow to be polite to MakerWorld). Later runs only re-download images that changed, so they take a few minutes.

**Schedule**: the workflow is manual only. To run it automatically, uncomment the `schedule:` block in `.github/workflows/sync-catalog.yml` and adjust the cron (e.g. `'0 9 * * 1'` = Mondays 09:00 UTC).

## When the sync breaks

- The failed run is marked red in the **Actions** tab, and GitHub emails you. Open the run → **sync** job → **Sync from MakerWorld** step to see each warning (which model, which collection, what happened).
- **The site keeps showing the last good data.** If a model can't be fetched, its previous version is kept. If a collection has a model that was never synced successfully, the collection keeps its previous version (or is left out if it's new). The script refuses to write an empty catalog, or one more than 30% smaller than before, unless you pass `--allow-shrink`.
- Typical causes:
  - **A typo in `config.yml`.** The step log says which line.
  - **A model was deleted from MakerWorld.** Remove it from `config.yml`.
  - **MakerWorld is blocking GitHub's servers** ("blocked by Cloudflare"). Run the sync locally instead and push.

## Repo size

Each model stores one 600px thumbnail plus up to six 1200px images (~280 KB per model). To trim, lower `MAX_IMAGES` or the WebP quality in `scripts/catalog-sync.mjs`. The next sync rewrites only new images, so delete `public/catalogo/img/` first to re-encode everything.
