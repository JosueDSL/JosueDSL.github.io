import type { APIRoute } from 'astro';
import { collections } from '../../lib/catalog';

/**
 * Detail data for the catalog modal, emitted as a static file at build time.
 * Kept out of the HTML so the first page load only carries the grid.
 */
export const GET: APIRoute = () => {
  const models: Record<
    string,
    { name: string; description: string; designer: string; images: [string, number, number][] }
  > = {};
  for (const c of collections) {
    for (const m of c.models) {
      models[m.id] ??= {
        name: m.name,
        description: m.description,
        designer: m.designer,
        images: m.images.map((img) => [img.src, img.width, img.height]),
      };
    }
  }
  return new Response(JSON.stringify({ models }), { headers: { 'Content-Type': 'application/json' } });
};
