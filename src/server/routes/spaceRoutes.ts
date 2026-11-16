import { Router, Request, Response } from 'express';
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
