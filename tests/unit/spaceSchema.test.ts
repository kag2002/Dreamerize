import { describe, it, expect } from 'vitest';
import {
  spaceConfigSchema,
  createSpaceSchema,
  updateSpaceSchema
} from '../../src/shared/schemas/spaceSchema';
import {
  DEFAULT_STARRY_NIGHT_CONFIG,
  DEFAULT_BREEZY_MEADOW_CONFIG
} from '../../src/server/db/seed';

describe('spaceSchema Unit Tests', () => {
  it('validates DEFAULT_STARRY_NIGHT_CONFIG successfully', () => {
    const result = spaceConfigSchema.safeParse(DEFAULT_STARRY_NIGHT_CONFIG);
    expect(result.success).toBe(true);
  });

  it('validates DEFAULT_BREEZY_MEADOW_CONFIG successfully', () => {
    const result = spaceConfigSchema.safeParse(DEFAULT_BREEZY_MEADOW_CONFIG);
    expect(result.success).toBe(true);
  });

  it('rejects invalid fog type', () => {
    const invalid = {
      ...DEFAULT_STARRY_NIGHT_CONFIG,
      fog: {
        ...DEFAULT_STARRY_NIGHT_CONFIG.fog,
        type: 'spherical'
      }
    };
    const result = spaceConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects negative fog density', () => {
    const invalid = {
      ...DEFAULT_STARRY_NIGHT_CONFIG,
      fog: {
        ...DEFAULT_STARRY_NIGHT_CONFIG.fog,
        density: -0.05
      }
    };
    const result = spaceConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects vector3 with wrong number of elements', () => {
    const invalid = {
      ...DEFAULT_STARRY_NIGHT_CONFIG,
      wind: {
        ...DEFAULT_STARRY_NIGHT_CONFIG.wind,
        direction: [1.0, 2.0] // Needs 3 numbers
      }
    };
    const result = spaceConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects audio volume outside 0.0 - 1.0 range', () => {
    const invalid = {
      ...DEFAULT_STARRY_NIGHT_CONFIG,
      audio: {
        ...DEFAULT_STARRY_NIGHT_CONFIG.audio,
        defaultVolume: 1.5
      }
    };
    const result = spaceConfigSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  describe('createSpaceSchema & updateSpaceSchema', () => {
    it('validates valid createSpace input', () => {
      const input = {
        slug: 'my-custom-space',
        name: 'My Custom Space',
        description: 'A beautiful test space',
        isPublished: true,
        config: DEFAULT_STARRY_NIGHT_CONFIG
      };

      const result = createSpaceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid slug with uppercase and spaces in createSpace', () => {
      const input = {
        slug: 'Invalid Slug!',
        name: 'Invalid Space',
        config: DEFAULT_STARRY_NIGHT_CONFIG
      };

      const result = createSpaceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('validates partial updates in updateSpaceSchema', () => {
      const input = {
        name: 'Updated Name',
        isPublished: false,
        config: {
          wind: {
            speed: 5.0,
            direction: [0, 1, 0] as [number, number, number],
            gustiness: 0.2,
            swayIntensity: 0.3
          }
        }
      };

      const result = updateSpaceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
