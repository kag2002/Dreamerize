import express, { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { authMiddleware, requireRole, optionalAuth } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { createSpaceSchema, updateSpaceSchema } from '../../shared/schemas/spaceSchema';
import {
  listSpaces,
  getSpaceByIdOrSlug,
  createSpace,
  updateSpace,
  deleteSpace
} from '../services/spaceService';

const router = Router();

export const ASSETS_UPLOAD_DIR = path.resolve(process.cwd(), 'uploads/3d-assets');
const ALLOWED_ASSET_EXTENSIONS = new Set(['splat', 'ply', 'glb']);
const SAFE_ASSET_FILENAME_RE = /^[a-zA-Z0-9._-]+\.(splat|ply|glb)$/;

function isContainedPath(baseDir: string, targetPath: string): boolean {
  const normalizedBase = path.resolve(baseDir);
  const normalizedTarget = path.resolve(targetPath);
  return normalizedTarget.startsWith(normalizedBase + path.sep);
}

// POST /api/spaces/assets (Creator only — upload .splat / .ply / .glb binary asset)
router.post(
  '/assets',
  authMiddleware,
  requireRole(['creator']),
  express.raw({
    type: ['application/octet-stream', 'model/gltf-binary', 'application/x-ply'],
    limit: '50mb'
  }),
  (req: Request, res: Response): void => {
    const rawFilename =
      (typeof req.query.filename === 'string' ? req.query.filename : undefined) ||
      (typeof req.headers['x-filename'] === 'string' ? req.headers['x-filename'] : undefined) ||
      '';

    const baseName = path.basename(rawFilename.trim());
    const ext = path.extname(baseName).toLowerCase().replace(/^\./, '');
    if (!ALLOWED_ASSET_EXTENSIONS.has(ext)) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Unsupported file extension. Only .splat, .ply, and .glb are permitted.'
      });
      return;
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Non-empty binary payload is required.'
      });
      return;
    }

    const safeName = `${crypto.randomUUID()}.${ext}`;
    fs.mkdirSync(ASSETS_UPLOAD_DIR, { recursive: true });
    const targetPath = path.resolve(ASSETS_UPLOAD_DIR, safeName);
    if (!isContainedPath(ASSETS_UPLOAD_DIR, targetPath)) {
      res.status(400).json({ error: 'BadRequest', message: 'Invalid target asset path' });
      return;
    }

    fs.writeFileSync(targetPath, req.body);

    res.status(201).json({
      success: true,
      assetUrl: `/api/spaces/assets/${safeName}`,
      assetFormat: ext,
      bytes: req.body.length
    });
  }
);

// GET /api/spaces/assets/:filename (Public static binary serving with strict path validation)
router.get('/assets/:filename', (req: Request, res: Response): void => {
  const filename = req.params.filename;
  if (
    !filename ||
    filename.includes('..') ||
    path.basename(filename) !== filename ||
    !SAFE_ASSET_FILENAME_RE.test(filename)
  ) {
    res.status(400).json({
      error: 'BadRequest',
      message: 'Invalid asset filename'
    });
    return;
  }

  const resolvedPath = path.resolve(ASSETS_UPLOAD_DIR, filename);
  if (!isContainedPath(ASSETS_UPLOAD_DIR, resolvedPath)) {
    res.status(400).json({
      error: 'BadRequest',
      message: 'Invalid asset path'
    });
    return;
  }

  if (!fs.existsSync(resolvedPath)) {
    res.status(404).json({
      error: 'NotFound',
      message: `Asset "${filename}" not found`
    });
    return;
  }

  const ext = path.extname(filename).toLowerCase();
  res.setHeader('Content-Type', ext === '.glb' ? 'model/gltf-binary' : 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(resolvedPath);
});

// GET /api/spaces (Public, optional auth)
router.get('/', optionalAuth, (req: Request, res: Response): void => {
  const isCreator = req.user?.role === 'creator';
  const creatorId = req.user?.id;
  const spaces = listSpaces(isCreator, creatorId);

  res.status(200).json({
    success: true,
    spaces
  });
});

// GET /api/spaces/:id (Public, optional auth)
router.get('/:id', optionalAuth, (req: Request, res: Response): void => {
  const isCreator = req.user?.role === 'creator';
  const creatorId = req.user?.id;
  const space = getSpaceByIdOrSlug(req.params.id, isCreator, creatorId);

  if (!space) {
    res.status(404).json({
      error: 'NotFound',
      message: `Space "${req.params.id}" not found`
    });
    return;
  }

  res.status(200).json({
    success: true,
    space
  });
});

// POST /api/spaces (Creator only)
router.post(
  '/',
  authMiddleware,
  requireRole(['creator']),
  validateBody(createSpaceSchema),
  (req: Request, res: Response): void => {
    try {
      const space = createSpace(req.body, req.user!.id);
      res.status(201).json({
        success: true,
        space
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'BadRequest',
        message: err.message || 'Failed to create space'
      });
    }
  }
);

// PUT /api/spaces/:id (Creator only)
router.put(
  '/:id',
  authMiddleware,
  requireRole(['creator']),
  validateBody(updateSpaceSchema),
  (req: Request, res: Response): void => {
    try {
      const space = updateSpace(req.params.id, req.body, req.user!.id);
      if (!space) {
        res.status(404).json({
          error: 'NotFound',
          message: `Space "${req.params.id}" not found`
        });
        return;
      }

      res.status(200).json({
        success: true,
        space
      });
    } catch (err: any) {
      res.status(400).json({
        error: 'BadRequest',
        message: err.message || 'Failed to update space'
      });
    }
  }
);

// DELETE /api/spaces/:id (Creator only)
router.delete(
  '/:id',
  authMiddleware,
  requireRole(['creator']),
  (req: Request, res: Response): void => {
    const deleted = deleteSpace(req.params.id);
    if (!deleted) {
      res.status(404).json({
        error: 'NotFound',
        message: `Space "${req.params.id}" not found`
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Space deleted successfully'
    });
  }
);

export default router;
