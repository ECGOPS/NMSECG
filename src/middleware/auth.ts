import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@/lib/types';
import { validateSessionToken, hasRequiredRole } from '@/utils/security';

// Extend Request type to include user information
declare module 'express' {
  interface Request {
    user?: {
      id: string;
      role: UserRole;
      region?: string;
      district?: string;
    };
  }
}

// Authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const sessionCookie = req.cookies.session;
  
  if (!sessionCookie) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const session = JSON.parse(sessionCookie);
    
    if (!validateSessionToken(session)) {
      res.clearCookie('session');
      return res.status(401).json({ error: 'Session expired' });
    }

    // In a real app, fetch user from database
    // For now, we'll use mock data
    const user = {
      id: session.userId,
      role: 'district_engineer' as UserRole,
      region: 'ACCRA EAST REGION',
      district: 'MAKOLA'
    };

    req.user = user;
    next();
  } catch (error) {
    res.clearCookie('session');
    return res.status(401).json({ error: 'Invalid session' });
  }
};

// Role-based access control middleware
export const authorize = (requiredRole: UserRole) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!hasRequiredRole(req.user.role, requiredRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
};

// Region-based access control middleware
export const authorizeRegion = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { region } = req.params;
  
  if (req.user.role !== 'global_engineer' && req.user.role !== 'system_admin' && req.user.region !== region) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

// District-based access control middleware
export const authorizeDistrict = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { district } = req.params;
  
  if (req.user.role === 'district_engineer' && req.user.district !== district) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}; 