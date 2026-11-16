import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

export const PORT = parseInt(process.env.PORT || '3001', 10);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const JWT_SECRET = process.env.JWT_SECRET || 'dreamerize-super-secret-jwt-key-2026';
export const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'data/dreamerize.db');
