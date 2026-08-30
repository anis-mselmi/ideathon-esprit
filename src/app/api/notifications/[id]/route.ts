import { prisma } from "@/lib/db";
import { ok, fail, requireUser, isResponse } from "@/lib/api";

// PATCH /api/notifications/:id — mark read (own notifications only).
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUser();
  if (isResponse(guard)) return guard;
  const { id } = await params;
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.userId !== guard.user.id) return fail("Not found", 404);
  const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
  return ok({ notification: updated });
}
