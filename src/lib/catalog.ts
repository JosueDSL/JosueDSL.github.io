/**
 * Build-time access to the 3D-print catalog.
 *
 * - catalog/data.generated.json — written by scripts/catalog-sync.mjs, never by hand.
 * - catalog/config.yml           — only `contact` is read here; it's re-read on every
 *   build so contact details change without re-syncing MakerWorld.
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import data from '../../catalog/data.generated.json';

export interface CatalogImage {
  src: string;
  width: number;
  height: number;
}

export interface CatalogModel {
  id: string;
  name: string;
  description: string;
  designer: string;
  thumb: CatalogImage;
  images: CatalogImage[];
}

export interface CatalogCollection {
  slug: string;
  name: string;
  description: string;
  models: CatalogModel[];
}

export interface CatalogContact {
  whatsapp: string;
  email: string;
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
}

const models = data.models as Record<string, CatalogModel>;

export const collections: CatalogCollection[] = data.collections.map((c) => ({
  slug: c.slug,
  name: c.name,
  description: c.description,
  models: c.models.map((id) => models[id]).filter((m): m is CatalogModel => Boolean(m)),
}));

export const ogImage: CatalogImage | null = data.og;

export function loadContact(): CatalogContact {
  const config = YAML.parse(fs.readFileSync(path.join(process.cwd(), 'catalog/config.yml'), 'utf8'));
  const c = config?.contact ?? {};
  for (const key of ['whatsapp', 'email', 'whatsapp_message', 'email_subject', 'email_body']) {
    if (!c[key]) throw new Error(`catalog/config.yml: contact.${key} is required`);
  }
  return {
    whatsapp: String(c.whatsapp).replace(/\D/g, ''),
    email: String(c.email).trim(),
    whatsappMessage: String(c.whatsapp_message),
    emailSubject: String(c.email_subject),
    emailBody: String(c.email_body),
  };
}
