import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

function resolveMusicFile(reqUrl: string, musicDir: string): string | null {
  const urlPath = reqUrl.split('?')[0] ?? '';
  if (!urlPath.startsWith('/music/')) return null;

  let decodedRel: string;
  try {
    decodedRel = decodeURIComponent(urlPath.slice('/music/'.length));
  } catch {
    return null;
  }

  if (!decodedRel || decodedRel.includes('\0') || decodedRel.includes('..')) {
    return null;
  }

  const normalizedRoot = path.resolve(musicDir);
  const candidate = path.resolve(normalizedRoot, decodedRel);
  if (!candidate.startsWith(normalizedRoot + path.sep)) {
    return null;
  }

  return candidate;
}

function getAudioMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.ogg') return 'audio/ogg';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.flac') return 'audio/flac';
  return 'application/octet-stream';
}

/**
 * Connect/Express compatible streaming middleware for `/music/*` assets.
 * Serves full RFC 9110 byte ranges (`Accept-Ranges: bytes`, `206 Partial Content`)
 * so HTMLAudioElement can buffer the complete track and loop seamlessly back to 0:00.
 */
export function createMusicStreamMiddleware(
  musicDir: string = path.resolve(process.cwd(), 'public', 'music')
) {
  return (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    const method = (req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      next();
      return;
    }

    const filePath = resolveMusicFile(req.url || '', musicDir);
    if (!filePath) {
      next();
      return;
    }

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      next();
      return;
    }

    if (!stat.isFile()) {
      next();
      return;
    }

    const fileSize = stat.size;
    const contentType = getAudioMimeType(filePath);
    const rangeHeader = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
      if (!match) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        res.end();
        return;
      }

      const rawStart = match[1];
      const rawEnd = match[2];

      let start: number;
      let end: number;

      if (rawStart === '' && rawEnd !== '') {
        const suffixLen = parseInt(rawEnd, 10);
        start = Math.max(0, fileSize - suffixLen);
        end = fileSize - 1;
      } else {
        start = rawStart ? parseInt(rawStart, 10) : 0;
        const parsedEnd = rawEnd ? parseInt(rawEnd, 10) : fileSize - 1;
        end = Math.min(parsedEnd, fileSize - 1);
      }

      if (!Number.isFinite(start) || !Number.isFinite(end) || start >= fileSize || start > end) {
        res.statusCode = 416;
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        res.end();
        return;
      }

      const chunkLength = end - start + 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', String(chunkLength));

      if (method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath, { start, end });
      res.on('close', () => {
        if (!stream.destroyed) stream.destroy();
      });
      stream.pipe(res);
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Length', String(fileSize));

    if (method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    res.on('close', () => {
      if (!stream.destroyed) stream.destroy();
    });
    stream.pipe(res);
  };
}
