import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { ok, fail, audit } from "@/lib/api";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "CLIENT"]).default("CLIENT"),
  locale: z.enum(["en", "fr", "ar"]).default("en"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("Invalid input", 422);

  const { email, password, fullName, phone, role, locale } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("An account with this email already exists.", 409);

  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), fullName, phone, role, locale },
  });

  const token = await createSession({
    id: user.id,
    email: user.email,
    role: user.role as "OWNER" | "CLIENT",
    fullName: user.fullName,
    locale: user.locale,
  });
  await setSessionCookie(token);
  await audit(user.id, "REGISTER", "User", user.id);

  return ok({ id: user.id, email: user.email, role: user.role, fullName: user.fullName });
}
