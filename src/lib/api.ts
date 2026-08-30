import { NextResponse } from "next/server";
import { getSession, SessionUser } from "./auth";
import { prisma } from "./db";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Guard: require a signed-in user (optionally with a specific role). */
export async function requireUser(
  role?: SessionUser["role"] | SessionUser["role"][]
): Promise<{ user: SessionUser } | NextResponse> {
  const user = await getSession();
  if (!user) return fail("Unauthorized", 401, "UNAUTHENTICATED");
  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(user.role)) return fail("Forbidden", 403, "FORBIDDEN");
  }
  return { user };
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

export async function audit(
  userId: string | null,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: unknown
) {
  await prisma.auditLog.create({
    data: {
      userId: userId ?? undefined,
      action,
      entity,
      entityId,
      meta: meta ? JSON.stringify(meta) : undefined,
    },
  });
}
