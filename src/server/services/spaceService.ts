import crypto from 'node:crypto';
import { getDatabase } from '../db/connection';
import { SpaceEntity, SpaceConfig } from '../../shared/types/space';
import { CreateSpaceInput, UpdateSpaceInput } from '../../shared/schemas/spaceSchema';

interface RawSpaceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  creator_id: string;
  is_published: number;
  config: string;
  created_at: string;
  updated_at: string;
}

function mapRowToEntity(row: RawSpaceRow): SpaceEntity {
  let parsedConfig: SpaceConfig;
  try {
    parsedConfig = JSON.parse(row.config);
  } catch {
    parsedConfig = {} as SpaceConfig;
  }

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    thumbnailUrl: row.thumbnail_url || undefined,
    creatorId: row.creator_id,
    isPublished: row.is_published === 1,
    config: parsedConfig,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listSpaces(isCreator = false, creatorId?: string): SpaceEntity[] {
  const db = getDatabase();

  let rows: RawSpaceRow[];
  if (isCreator) {
    if (creatorId) {
      rows = db
        .prepare('SELECT * FROM spaces WHERE is_published = 1 OR creator_id = ? ORDER BY created_at DESC')
        .all(creatorId) as unknown as RawSpaceRow[];
    } else {
      rows = db
        .prepare('SELECT * FROM spaces ORDER BY created_at DESC')
        .all() as unknown as RawSpaceRow[];
    }
  } else {
    rows = db
      .prepare('SELECT * FROM spaces WHERE is_published = 1 ORDER BY created_at DESC')
      .all() as unknown as RawSpaceRow[];
  }

  return rows.map(mapRowToEntity);
}

export function getSpaceByIdOrSlug(
  idOrSlug: string,
  isCreator = false,
  creatorId?: string
): SpaceEntity | null {
  const db = getDatabase();

  const row = db
    .prepare('SELECT * FROM spaces WHERE id = ? OR slug = ?')
    .get(idOrSlug, idOrSlug) as unknown as RawSpaceRow | undefined;

  if (!row) {
    return null;
  }

  // If unpublished, only creator or owner can view
  if (row.is_published === 0 && !isCreator && row.creator_id !== creatorId) {
    return null;
  }

  return mapRowToEntity(row);
}

export function createSpace(input: CreateSpaceInput, creatorId: string): SpaceEntity {
  const db = getDatabase();

  const existing = db
    .prepare('SELECT id FROM spaces WHERE slug = ?')
    .get(input.slug) as { id: string } | undefined;

  if (existing) {
    throw new Error(`Space with slug "${input.slug}" already exists`);
  }

  const spaceId = `space-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const isPublished = input.isPublished !== false ? 1 : 0;
  const configJson = JSON.stringify(input.config);

  db.prepare(`
    INSERT INTO spaces (id, slug, name, description, thumbnail_url, creator_id, is_published, config, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    spaceId,
    input.slug,
    input.name,
    input.description || '',
    input.thumbnailUrl || null,
    creatorId,
    isPublished,
    configJson,
    now,
    now
  );

  return {
    id: spaceId,
    slug: input.slug,
    name: input.name,
    description: input.description || '',
    thumbnailUrl: input.thumbnailUrl,
    creatorId,
    isPublished: isPublished === 1,
    config: input.config,
    createdAt: now,
    updatedAt: now
  };
}

export function updateSpace(
  idOrSlug: string,
  input: UpdateSpaceInput,
  _creatorId: string
): SpaceEntity | null {
  const db = getDatabase();

  const existingRow = db
    .prepare('SELECT * FROM spaces WHERE id = ? OR slug = ?')
    .get(idOrSlug, idOrSlug) as RawSpaceRow | undefined;

  if (!existingRow) {
    return null;
  }

  // Check slug uniqueness if changing slug
  if (input.slug && input.slug !== existingRow.slug) {
    const slugTaken = db
      .prepare('SELECT id FROM spaces WHERE slug = ? AND id != ?')
      .get(input.slug, existingRow.id);
    if (slugTaken) {
      throw new Error(`Slug "${input.slug}" is already taken by another space`);
    }
  }

  const existingEntity = mapRowToEntity(existingRow);
  const now = new Date().toISOString();

  const updatedSlug = input.slug ?? existingRow.slug;
  const updatedName = input.name ?? existingRow.name;
  const updatedDescription = input.description ?? existingRow.description ?? '';
  const updatedThumbnail = input.thumbnailUrl !== undefined ? input.thumbnailUrl : existingRow.thumbnail_url;
  const updatedIsPublished = input.isPublished !== undefined ? (input.isPublished ? 1 : 0) : existingRow.is_published;

  let mergedConfig: SpaceConfig = existingEntity.config;
  if (input.config) {
    mergedConfig = {
      ...existingEntity.config,
      ...input.config
    };
  }

  const configJson = JSON.stringify(mergedConfig);

  db.prepare(`
    UPDATE spaces
    SET slug = ?, name = ?, description = ?, thumbnail_url = ?, is_published = ?, config = ?, updated_at = ?
    WHERE id = ?
  `).run(
    updatedSlug,
    updatedName,
    updatedDescription,
    updatedThumbnail,
    updatedIsPublished,
    configJson,
    now,
    existingRow.id
  );

  return {
    id: existingRow.id,
    slug: updatedSlug,
    name: updatedName,
    description: updatedDescription,
    thumbnailUrl: updatedThumbnail || undefined,
    creatorId: existingRow.creator_id,
    isPublished: updatedIsPublished === 1,
    config: mergedConfig,
    createdAt: existingRow.created_at,
    updatedAt: now
  };
}

export function deleteSpace(idOrSlug: string): boolean {
  const db = getDatabase();

  const existing = db
    .prepare('SELECT id FROM spaces WHERE id = ? OR slug = ?')
    .get(idOrSlug, idOrSlug) as { id: string } | undefined;

  if (!existing) {
    return false;
  }

  db.prepare('DELETE FROM spaces WHERE id = ?').run(existing.id);
  return true;
}
