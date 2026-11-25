import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';

export const COOKIE_NAME = 'token';

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });
}

/** Short-lived token carried through Slack's OAuth `state` param (cookie isn't sent to PUBLIC_URL). */
export function signSlackState(userId: string): string {
  return jwt.sign({ sub: userId, purpose: 'slack' }, config.jwtSecret, { expiresIn: '10m' });
}

export function verifySlackState(state: string): string | null {
  try {
    const p = jwt.verify(state, config.jwtSecret) as jwt.JwtPayload;
    return p.purpose === 'slack' && typeof p.sub === 'string' ? p.sub : null;
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const p = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    req.userId = p.sub as string;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired' });
  }
}
