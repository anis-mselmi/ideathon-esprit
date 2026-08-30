import { prisma } from "@/lib/db";
import { ok, requireUser, isResponse } from "@/lib/api";

// GET /api/notifications — the current user's own notifications only.
export async function GET() {
  const guard = await requireUser();
  if (isResponse(guard)) return guard;
  const notifications = await prisma.notification.findMany({
    where: { userId: guard.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = notifications.filter((n) => !n.read).length;
  return ok({ notifications, unread });
}
