#!/usr/bin/env node
/**
 * Sync the 3D-print catalog from MakerWorld.
 *
 *   catalog/config.yml           (input, hand-edited)
 *   catalog/data.generated.json  (output, read by src/pages/catalogo/)
 *   public/catalogo/img/<id>/    (output, WebP images)
 *   public/catalogo/og.jpg       (output, social preview collage)
 *
 * Collection membership comes from config.yml because MakerWorld puts its
 * collection endpoints behind a Cloudflare challenge. Model details come from
 * the public design endpoint (`/api/v1/design-service/design/<id>`).
 *
 * Fail-safe: anything that can't be fetched falls back to the previous
 * data.generated.json. The script exits non-zero whenever that happens, but
 * only ever writes a complete, safe catalog. See CATALOG.md.
 *
 * Flags:
 *   --allow-shrink  accept a catalog more than 30% smaller than the previous one
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import YAML from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'catalog/config.yml');
const DATA_PATH = path.join(ROOT, 'catalog/data.generated.json');
const IMG_DIR = path.join(ROOT, 'public/catalogo/img');
const IMG_URL = '/catalogo/img';
const OG_PATH = path.join(ROOT, 'public/catalogo/og.jpg');

const API = 'https://makerworld.com/api/v1/design-service';
const USER_AGENT = 'josueds.me-catalog-sync/1.0 (+https://www.josueds.me/catalogo/; contact@josueds.me)';
const API_DELAY_MS = 1000;
const CDN_DELAY_MS = 250;
const MAX_RETRIES = 4;
const MAX_IMAGES = 6; // cover + up to 5 gallery images
const FULL_SIZE = 1200;
const THUMB_SIZE = 600;
const DESCRIPTION_MAX = 600;
const SHRINK_LIMIT = 0.7;
const BLOCKED_ABORT_AFTER = 3;

const allowShrink = process.argv.includes('--allow-shrink');

class HttpError extends Error {
  constructor(status, url, blocked = false) {
    super(blocked ? `blocked by Cloudflare (${status}) at ${url}` : `HTTP ${status} at ${url}`);
    this.status = status;
    this.blocked = blocked;
  }
}

const log = (...a) => console.log(...a);
const warnings = [];
function warn(msg) {
  warnings.push(msg);
  // GitHub Actions annotation; plain text elsewhere.
  console.warn(process.env.GITHUB_ACTIONS ? `::warning::${msg}` : `WARN ${msg}`);
}

// --- HTTP ------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lastRequestAt = new Map();

/** Sequential, rate-limited fetch with exponential backoff. Never retries a Cloudflare block. */
async function politeFetch(url, delayMs) {
  const host = new URL(url).host;
  const wait = (lastRequestAt.get(host) ?? 0) + delayMs - Date.now();
  if (wait > 0) await sleep(wait);

  for (let attempt = 0; ; attempt++) {
    lastRequestAt.set(host, Date.now());
    let res;
    try {
      res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' } });
    } catch (err) {
      if (attempt >= MAX_RETRIES) throw err;
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    if (res.ok) return res;

    const challenged =
      res.status === 403 &&
      (res.headers.get('cf-mitigated') || res.headers.get('content-type')?.includes('text/html'));
    if (challenged) throw new HttpError(res.status, url, true);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= MAX_RETRIES) throw new HttpError(res.status, url);

    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
  }
}

// --- Config ----------------------------------------------------------------

function parseModelId(item) {
  const s = String(item).trim();
  const m = s.match(/\/models\/(\d+)/) ?? s.match(/^(\d+)$/);
  if (!m) throw new Error(`config.yml: can't read a model ID from "${s}"`);
  return m[1];
}

function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function loadConfig() {
  const cfg = YAML.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  if (!Array.isArray(cfg?.collections) || cfg.collections.length === 0) {
    throw new Error('config.yml: `collections` must be a non-empty list');
  }
  const seenSlugs = new Set();
  const collections = cfg.collections.map((c, i) => {
    if (!c?.name) throw new Error(`config.yml: collection #${i + 1} needs a \`name\``);
    const collectionId = String(c.url ?? '').match(/collections\/(\d+)/)?.[1];
    let slug = slugify(c.name) || `coleccion-${i + 1}`;
    while (seenSlugs.has(slug)) slug += '-2';
    seenSlugs.add(slug);
    return {
      key: collectionId ? `mw-${collectionId}` : slug,
      slug,
      name: String(c.name),
      description: c.description ? String(c.description).trim() : '',
      url: c.url ?? null,
      modelIds: [...new Set((c.models ?? []).map(parseModelId))],
    };
  });
  const overrides = {};
  for (const [id, o] of Object.entries(cfg.overrides ?? {})) overrides[parseModelId(id)] = o ?? {};
  return { collections, overrides };
}

// --- MakerWorld --------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function htmlToText(html, max = DESCRIPTION_MAX) {
  let text = String(html ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#')
        return String.fromCodePoint(
          e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)),
        );
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length > max) {
    const cut = text.slice(0, max);
    text = cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.8)).replace(/[\s.,;:–-]+$/, '') + '…';
  }
  return text;
}

async function fetchModel(id) {
  const res = await politeFetch(`${API}/design/${id}`, API_DELAY_MS);
  const d = await res.json();
  if (!d?.id || !d?.title) throw new Error(`unexpected design payload for ${id}`);
  const pictures = d.designExtension?.design_pictures ?? [];
  const sources = [...new Set([d.coverUrl, ...pictures.map((p) => p?.url)].filter(Boolean))].slice(
    0,
    MAX_IMAGES,
  );
  if (sources.length === 0) throw new Error(`model ${id} has no images`);
  return {
    id: String(d.id),
    title: String(d.title).trim(),
    description: htmlToText(d.summary),
    designer: d.designCreator?.name ?? '',
    url: `https://makerworld.com/en/models/${d.id}${d.slug ? `-${d.slug}` : ''}`,
    sources,
  };
}

// --- Images ----------------------------------------------------------------

const hashOf = (s) => createHash('sha1').update(s).digest('hex').slice(0, 10);

async function downloadImage(src) {
  // Let the CDN do a first resize + WebP pass so we don't pull multi-MB originals.
  const sized = `${src}${src.includes('?') ? '&' : '?'}x-oss-process=image/resize,w_${FULL_SIZE}/quality,q_90/format,webp`;
  try {
    const res = await politeFetch(sized, CDN_DELAY_MS);
    if (res.headers.get('content-type')?.startsWith('image/')) return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (err instanceof HttpError && err.blocked) throw err;
  }
  const res = await politeFetch(src, CDN_DELAY_MS);
  return Buffer.from(await res.arrayBuffer());
}

async function writeWebp(input, size, quality, file) {
  const info = await sharp(input)
    .rotate()
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toFile(file);
  return { width: info.width, height: info.height };
}

async function dimensions(file) {
  const m = await sharp(file).metadata();
  return { width: m.width, height: m.height };
}

/** Download/convert a model's images, reusing files already on disk. */
async function syncImages(model) {
  const dir = path.join(IMG_DIR, model.id);
  await fs.mkdir(dir, { recursive: true });
  const images = [];
  let thumb = null;
  for (const [i, source] of model.sources.entries()) {
    const h = hashOf(source);
    const fullName = `${h}-${FULL_SIZE}.webp`;
    const thumbName = `${h}-${THUMB_SIZE}.webp`;
    const fullFile = path.join(dir, fullName);
    const thumbFile = path.join(dir, thumbName);
    const needThumb = i === 0;

    let buf = null;
    if (!existsSync(fullFile) || (needThumb && !existsSync(thumbFile))) buf = await downloadImage(source);

    const full =
      buf && !existsSync(fullFile)
        ? await writeWebp(buf, FULL_SIZE, 68, fullFile)
        : await dimensions(fullFile);
    images.push({ src: `${IMG_URL}/${model.id}/${fullName}`, ...full, source });
    if (needThumb) {
      const t =
        buf && !existsSync(thumbFile)
          ? await writeWebp(buf, THUMB_SIZE, 72, thumbFile)
          : await dimensions(thumbFile);
      thumb = { src: `${IMG_URL}/${model.id}/${thumbName}`, ...t };
    }
  }
  return { thumb, images };
}

async function removeUnreferencedImages(models) {
  if (!existsSync(IMG_DIR)) return;
  const keep = new Set();
  for (const m of Object.values(models)) {
    keep.add(m.thumb.src);
    for (const img of m.images) keep.add(img.src);
  }
  for (const id of await fs.readdir(IMG_DIR)) {
    const dir = path.join(IMG_DIR, id);
    if (!(await fs.stat(dir)).isDirectory()) continue;
    if (!models[id]) {
      await fs.rm(dir, { recursive: true, force: true });
      log(`  removed images of ${id} (no longer in any collection)`);
      continue;
    }
    for (const f of await fs.readdir(dir)) {
      if (!keep.has(`${IMG_URL}/${id}/${f}`)) await fs.rm(path.join(dir, f));
    }
  }
}

/** 1200×630 collage of the first covers, for WhatsApp/Open Graph previews. */
async function buildOgImage(data) {
  const ids = [...new Set(data.collections.flatMap((c) => c.models))].slice(0, 6);
  const signature = hashOf(ids.map((id) => data.models[id].images[0].src).join('|'));
  if (data.og?.signature === signature && existsSync(OG_PATH)) return data.og;
  const W = 400;
  const H = 315;
  const tiles = await Promise.all(
    ids.map(async (id, i) => ({
      input: await sharp(path.join(ROOT, 'public', data.models[id].images[0].src))
        .resize(W, H, { fit: 'cover' })
        .toBuffer(),
      left: (i % 3) * W,
      top: Math.floor(i / 3) * H,
    })),
  );
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#1e1e20' } })
    .composite(tiles)
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(OG_PATH);
  return { src: '/catalogo/og.jpg', width: 1200, height: 630, signature };
}

async function dirSize(dir) {
  if (!existsSync(dir)) return { bytes: 0, files: 0 };
  let bytes = 0;
  let files = 0;
  for (const e of await fs.readdir(dir, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) {
      bytes += (await fs.stat(path.join(e.parentPath, e.name))).size;
      files++;
    }
  }
  return { bytes, files };
}

// --- Main ------------------------------------------------------------------

async function main() {
  const { collections, overrides } = await loadConfig();
  const prev = existsSync(DATA_PATH) ? JSON.parse(await fs.readFile(DATA_PATH, 'utf8')) : null;
  const prevModels = prev?.models ?? {};

  const wanted = [...new Set(collections.flatMap((c) => c.modelIds))].filter(
    (id) => overrides[id]?.hidden !== true,
  );
  log(`Syncing ${wanted.length} unique models from ${collections.length} collections…`);

  const fresh = {};
  const failed = new Set();
  let consecutiveBlocks = 0;
  for (const [n, id] of wanted.entries()) {
    if (consecutiveBlocks >= BLOCKED_ABORT_AFTER) {
      failed.add(id);
      continue;
    }
    try {
      const model = await fetchModel(id);
      const { thumb, images } = await syncImages(model);
      const { sources, ...rest } = model;
      fresh[id] = { ...rest, thumb, images };
      consecutiveBlocks = 0;
      log(`  [${n + 1}/${wanted.length}] ${id} ${model.title}`);
    } catch (err) {
      failed.add(id);
      if (err instanceof HttpError && err.blocked) consecutiveBlocks++;
      warn(`model ${id}: ${err.message}${prevModels[id] ? ' (keeping previous data)' : ''}`);
    }
  }
  if (consecutiveBlocks >= BLOCKED_ABORT_AFTER) {
    warn(
      `MakerWorld is blocking requests; stopped after ${BLOCKED_ABORT_AFTER} blocks to stay polite. Try a local sync.`,
    );
  }

  // Resolve each collection; fall back to its previous version if anything is missing.
  const models = {};
  const outCollections = [];
  for (const c of collections) {
    const visible = c.modelIds.filter((id) => overrides[id]?.hidden !== true);
    const missing = visible.filter((id) => !fresh[id] && !prevModels[id]);
    const prevCollection = prev?.collections?.find((p) => p.key === c.key);

    if (visible.length === 0) {
      warn(`collection "${c.name}" has no visible models; it is skipped`);
      continue;
    }
    if (missing.length > 0) {
      if (prevCollection && prevCollection.models.every((id) => prevModels[id])) {
        warn(
          `collection "${c.name}": ${missing.length} model(s) unavailable (${missing.join(', ')}); keeping its previous version`,
        );
        for (const id of prevCollection.models) models[id] = fresh[id] ?? prevModels[id];
        outCollections.push({
          ...prevCollection,
          name: c.name,
          description: c.description,
          slug: c.slug,
          url: c.url,
        });
      } else {
        warn(
          `collection "${c.name}": ${missing.length} model(s) unavailable (${missing.join(', ')}) and no previous data; section left out`,
        );
      }
      continue;
    }
    for (const id of visible) models[id] = fresh[id] ?? prevModels[id];
    outCollections.push({
      key: c.key,
      slug: c.slug,
      name: c.name,
      description: c.description,
      url: c.url,
      models: visible,
    });
  }

  // Overrides are applied on top of whatever MakerWorld (or the fallback) returned.
  for (const [id, m] of Object.entries(models)) {
    const o = overrides[id] ?? {};
    models[id] = {
      ...m,
      name: o.name ? String(o.name) : m.title,
      description: o.description != null ? String(o.description).trim() : m.description,
    };
  }

  const count = Object.keys(models).length;
  const prevCount = Object.keys(prevModels).length;
  if (count === 0) throw new Error('refusing to write an empty catalog');
  if (prevCount > 0 && count < prevCount * SHRINK_LIMIT && !allowShrink) {
    throw new Error(
      `catalog would shrink from ${prevCount} to ${count} models; re-run with --allow-shrink if that's intended`,
    );
  }

  const data = {
    generatedAt: prev?.generatedAt ?? null,
    collections: outCollections,
    models,
    og: prev?.og ?? null,
  };
  await removeUnreferencedImages(models);
  data.og = await buildOgImage(data);

  const comparable = (d) => JSON.stringify({ ...d, generatedAt: null });
  if (!prev || comparable(prev) !== comparable(data)) {
    data.generatedAt = new Date().toISOString();
    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2) + '\n');
    log(`\nWrote ${path.relative(ROOT, DATA_PATH)}: ${outCollections.length} collections, ${count} models.`);
  } else {
    log('\nNo changes.');
  }

  const { bytes, files } = await dirSize(IMG_DIR);
  log(`Images: ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB in ${path.relative(ROOT, IMG_DIR)}/`);

  if (warnings.length > 0) {
    console.error(
      `\nSync finished with ${warnings.length} warning(s); the catalog kept its last good data where needed.`,
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(process.env.GITHUB_ACTIONS ? `::error::${err.message}` : `ERROR ${err.message}`);
  process.exitCode = 1;
});
