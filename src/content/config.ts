import { defineCollection, z } from 'astro:content';

const robotsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    rrn: z.string().regex(/^RRN-\d{8}$/, 'RRN must be in format RRN-XXXXXXXX'),
    name: z.string().min(1),
    manufacturer: z.string().min(1),
    model: z.string().min(1),
    description: z.string(),
    image: z.string().optional(),
    production_year: z.number().int().min(1950).max(2100).optional(),
    status: z.enum(['active', 'retired', 'prototype', 'concept']).default('active'),

    // Links
    urdf_url: z.string().url().optional(),
    github_url: z.string().url().optional(),
    website: z.string().url().optional(),

    // Technical specs
    specs: z.object({
      weight_kg: z.number().positive().optional(),
      dimensions: z.string().optional(),
      max_speed_mps: z.number().positive().optional(),
      dof: z.number().int().positive().optional(),
      ros_version: z.array(z.string()).optional(),
      sensors: z.array(z.string()).optional(),
      compute: z.string().optional(),
      payload_kg: z.number().positive().optional(),
      battery_life_hours: z.number().positive().optional(),
      reach_mm: z.number().positive().optional(),
    }).optional(),

    // Ownership
    owner: z.object({
      name: z.string(),
      type: z.enum(['individual', 'company', 'research', 'community']),
      website: z.string().url().optional(),
    }).optional(),

    // Ownership history for tracking transfers
    ownership_history: z.array(z.object({
      owner_name: z.string(),
      owner_type: z.enum(['individual', 'company', 'research', 'community']),
      owner_website: z.string().url().optional(),
      acquired_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      transferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      transfer_reason: z.string().optional(),
      verified: z.boolean().default(false),
    })).optional(),

    // RCAN integration
    ruri: z.string().nullable().optional(),

    // Metadata
    submitted_by: z.string().optional(),
    submitted_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = {
  robots: robotsCollection,
};

