import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import authRoutes from './routes/authRoutes';
import spaceRoutes from './routes/spaceRoutes';
import healthRoutes from './routes/healthRoutes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  // Static assets
  const publicDir = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  const clientDistDir = path.resolve(process.cwd(), 'dist/client');
  if (fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
  }

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/spaces', spaceRoutes);
  app.use('/api/health', healthRoutes);

  // Client SPA fallback if in production client build exists
  if (fs.existsSync(clientDistDir)) {
    app.get('*', (_req, res, next) => {
      if (_req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  // Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
