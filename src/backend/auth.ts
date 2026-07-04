import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma as _prisma } from "../lib/prisma";
const prisma = _prisma as any;

const SESSION_TTL_DAYS = 30;

export interface AuthAccount {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
}

export interface AuthMembership {
  id: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  name: string | null;
  permissions: string[] | null;
}

export interface AuthenticatedRequest extends Request {
  account?: AuthAccount;
  sessionToken?: string;
  membership?: AuthMembership;
}

// Tabs restritas ao proprietário, mesmo com allowlist de permissões explícita.
// Mantido em sincronia com OWNER_ONLY_TABS em src/features/dashboard/types.ts.
const OWNER_ONLY_TABS = new Set(["profile", "staff", "ifood"]);

export function membershipCanAccess(membership: AuthMembership, tabId: string): boolean {
  if (membership.role === "OWNER") return true;
  if (OWNER_ONLY_TABS.has(tabId)) return false;
  if (membership.permissions === null) return true;
  return membership.permissions.includes(tabId);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, savedHash] = storedHash.split(":");
  if (!salt || !savedHash) return false;

  const computedHash = scryptSync(password, salt, 64);
  const savedBuffer = Buffer.from(savedHash, "hex");

  if (savedBuffer.length !== computedHash.length) return false;
  return timingSafeEqual(savedBuffer, computedHash);
}

export async function createAuthSession(accountId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.authSession.create({
    data: {
      accountId,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function deleteAuthSession(token: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { token } });
}

export async function getSessionAccount(token: string): Promise<AuthAccount | null> {
  if (!token) return null;

  const session = await prisma.authSession.findUnique({
    where: { token },
    include: {
      account: {
        select: {
          id: true,
          email: true,
          name: true,
          isSuperAdmin: true,
        },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return session.account;
}

export async function listAccountTenants(accountId: string) {
  const memberships = await prisma.tenantMembership.findMany({
    where: { accountId },
    include: {
      tenant: {
        include: {
          wppInstance: true,
          wppBotConfig: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return memberships.map((membership) => ({
    membershipId: membership.id,
    role: membership.role,
    memberName: (membership as any).name ?? null,
    permissions: (membership as any).permissions ? JSON.parse((membership as any).permissions) : null,
    tenant: membership.tenant,
  }));
}

export async function getAuthorizedTenantBySlug(accountId: string, slug: string) {
  const membership = await prisma.tenantMembership.findFirst({
    where: {
      accountId,
      tenant: { slug },
    },
    include: {
      tenant: {
        include: {
          wppInstance: true,
          wppBotConfig: true,
        },
      },
    },
  });

  if (!membership) return null;
  return {
    tenant: membership.tenant,
    membership: {
      id: membership.id,
      role: membership.role as "OWNER" | "ADMIN" | "STAFF",
      name: (membership as any).name ?? null,
      permissions: (membership as any).permissions ? JSON.parse((membership as any).permissions) : null,
    },
  };
}

export async function getAuthorizedTenantById(accountId: string, tenantId: string) {
  const membership = await prisma.tenantMembership.findFirst({
    where: {
      accountId,
      tenantId,
    },
    include: {
      tenant: {
        include: {
          wppInstance: true,
          wppBotConfig: true,
        },
      },
    },
  });

  if (!membership) return null;
  return {
    tenant: membership.tenant,
    membership: {
      id: membership.id,
      role: membership.role as "OWNER" | "ADMIN" | "STAFF",
      name: (membership as any).name ?? null,
      permissions: (membership as any).permissions ? JSON.parse((membership as any).permissions) : null,
    },
  };
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  const token = readBearerToken(req);

  if (!token) {
    authReq.account = undefined;
    authReq.sessionToken = undefined;
    return next();
  }

  const account = await getSessionAccount(token);
  authReq.account = account ?? undefined;
  authReq.sessionToken = account ? token : undefined;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.account) {
    return res.status(401).json({ error: "Login obrigatório." });
  }

  next();
}
