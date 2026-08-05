import { type Request, type Response, type NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.session.userRole ?? "")) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

/** Check a granular permission from the roles table. */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const perms: string[] = req.session.userPermissions ?? [];
    if (!perms.includes(permission)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

declare module "express-session" {
  interface SessionData {
    userId: number;
    userRole: string;
    userEmail: string;
    userName: string;
    userPermissions: string[];
    userRoleId: number | null;
  }
}
