import { z } from 'zod';

export const fogConfigSchema = z.object({
  type: z.enum(['linear', 'exp2']),
  color: z.string().min(1),
  density: z.number().nonnegative(),
  near: z.number().optional(),
  far: z.number().optional()
});

export const skyConfigSchema = z.object({
  type: z.enum([
    'starry_night_flow',
    'procedural_clouds',
    'gradient',
    'cosmic_nebula',
    'misty_mountain',
    'paradise_sky',
    'ghibli_coastal',
    'vietnam_heritage',
    'custom_asset'
  ]),
  topColor: z.string().min(1),
  bottomColor: z.string().min(1),
  horizonColor: z.string().min(1),
  swirlSpeed: z.number(),
  starDensity: z.number().nonnegative(),
  cloudCoverage: z.number().min(0).max(1).optional(),
  cloudSpeed: z.number().optional(),
  moonGlow: z.number().min(0).max(1).optional()
});

export const vector3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const windConfigSchema = z.object({
  speed: z.number(),
  direction: vector3Schema,
  gustiness: z.number().nonnegative(),
  swayIntensity: z.number().nonnegative()
});

export const pointLightSchema = z.object({
  color: z.string().min(1),
  intensity: z.number().nonnegative(),
  distance: z.number().nonnegative(),
  position: vector3Schema
});

export const lightingConfigSchema = z.object({
  ambient: z.object({
    color: z.string().min(1),
    intensity: z.number().nonnegative()
  }),
  directional: z.object({
    color: z.string().min(1),
    intensity: z.number().nonnegative(),
    position: vector3Schema,
    castShadow: z.boolean()
  }),
  pointLights: z.array(pointLightSchema)
});

export const shaderUniformsConfigSchema = z.object({
  swirlFlow: z
    .object({
      frequency: z.number(),
      amplitude: z.number(),
      timeScale: z.number()
    })
    .optional(),
  grassSway: z
    .object({
      stiffness: z.number(),
      windInfluence: z.number(),
      noiseScale: z.number().optional()
    })
    .optional(),
  flowerFlutter: z
    .object({
      frequency: z.number(),
      amplitude: z.number()
    })
    .optional()
});

export const audioConfigSchema = z.object({
  trackId: z.string().min(1),
  name: z.string().min(1),
  sourceUrl: z.string().min(1),
  defaultVolume: z.number().min(0).max(1),
  loop: z.boolean(),
  ambientType: z.enum(['audio_buffer', 'procedural_synth']),
  reverb: z
    .object({
      decay: z.number().nonnegative(),
      wet: z.number().min(0).max(1)
    })
    .optional()
});

export const cameraConfigSchema = z.object({
  spawnPosition: vector3Schema,
  lookAt: vector3Schema,
  fov: z.number().positive(),
  moveSpeed: z.number().positive(),
  wanderSpeed: z.number().positive(),
  wanderRadius: z.number().positive(),
  wanderWaypoints: z.array(vector3Schema),
  heightOffset: z.number()
});

export function isSafeAssetUrl(rawUrl: string): boolean {
  if (rawUrl === '') return true;
  const trimmed = rawUrl.trim();
  if (trimmed !== rawUrl || trimmed.length > 1024 || trimmed.includes('\\')) {
    return false;
  }

  let decoded = trimmed;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return false;
  }

  const lower = decoded.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }

  if (trimmed.includes('..') || decoded.includes('..')) {
    return false;
  }

  if (trimmed.startsWith('/api/') || trimmed.startsWith('/samples/')) {
    return !trimmed.startsWith('//');
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const assetUrlSchema = z
  .string()
  .refine(isSafeAssetUrl, {
    message: 'assetUrl must be empty, a safe /api/ or /samples/ path, or an http(s):// URL without path traversal'
  });

export const assetFormatSchema = z.enum(['procedural', 'splat', 'ply', 'glb']);

export const spaceConfigSchema = z.object({
  fog: fogConfigSchema,
  sky: skyConfigSchema,
  wind: windConfigSchema,
  lighting: lightingConfigSchema,
  shaders: shaderUniformsConfigSchema,
  audio: audioConfigSchema,
  camera: cameraConfigSchema,
  assetUrl: assetUrlSchema.optional(),
  assetFormat: assetFormatSchema.optional()
});

export const createSpaceSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  name: z.string().min(1).max(100),
  description: z.string().optional().default(''),
  thumbnailUrl: z.string().optional(),
  isPublished: z.boolean().optional().default(true),
  config: spaceConfigSchema
});

export const updateSpaceSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens')
    .optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  isPublished: z.boolean().optional(),
  config: spaceConfigSchema.partial().optional()
});

export type SpaceConfigInput = z.infer<typeof spaceConfigSchema>;
export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;
