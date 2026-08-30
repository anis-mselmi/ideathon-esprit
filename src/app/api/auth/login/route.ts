import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";
import { ok, fail, audit } from "@/lib/api";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid input", 422);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return fail("Invalid email or password.", 401);
  }

  const token = await createSession({
    id: user.id,
    email: user.email,
    role: user.role as "OWNER" | "CLIENT",
    fullName: user.fullName,
    locale: user.locale,
  });
  await setSessionCookie(token);
  await audit(user.id, "LOGIN", "User", user.id);

  return ok({ id: user.id, email: user.email, role: user.role, fullName: user.fullName, locale: user.locale });
}
