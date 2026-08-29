import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    stack: z.array(z.string()),
    role: z.string(),
    /** Employer this work was done for; omit for personal projects. */
    company: z.string().optional(),
    companyUrl: z.string().url().optional(),
    links: z
      .object({
        repo: z.string().url().optional(),
        live: z.string().url().optional(),
      })
      .default({}),
    featured: z.boolean().default(false),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    order: z.number().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const videos = defineCollection({
  loader: file('./src/content/videos/videos.json'),
  schema: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    start: z.number().optional(),
  }),
});

const experience = defineCollection({
  loader: file('./src/content/experience/experience.json'),
  schema: z.object({
    company: z.string(),
    url: z.string().url().optional(),
    role: z.string(),
    /** `YYYY-MM`. A null `end` renders as "Present". */
    start: z.string().regex(/^\d{4}-\d{2}$/),
    end: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .nullable()
      .default(null),
    order: z.number(),
    stack: z.array(z.string()).default([]),
    highlights: z.array(z.string()).default([]),
  }),
});

export const collections = { projects, blog, videos, experience };
