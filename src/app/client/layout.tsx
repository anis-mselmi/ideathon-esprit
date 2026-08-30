import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell, NavItem } from "@/components/AppShell";

const NAV: NavItem[] = [
  { href: "/client", labelKey: "nav.browse", icon: "🛵" },
  { href: "/client/rentals", labelKey: "nav.myRentals", icon: "📅" },
  { href: "/client/notifications", labelKey: "nav.notifications", icon: "🔔" },
  { href: "/client/profile", labelKey: "nav.profile", icon: "👤" },
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "OWNER") redirect("/owner");
  return (
    <AppShell nav={NAV} user={{ fullName: session.fullName, role: session.role }}>
      {children}
    </AppShell>
  );
}
