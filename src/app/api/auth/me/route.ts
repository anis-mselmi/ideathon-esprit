import { getSession } from "@/lib/auth";
import { ok } from "@/lib/api";

export async function GET() {
  const user = await getSession();
  return ok({ user });
}
