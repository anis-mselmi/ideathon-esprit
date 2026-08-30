import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell, NavItem } from "@/components/AppShell";

const NAV: NavItem[] = [
  { href: "/owner", labelKey: "nav.commandCenter", icon: "🛰️" },
  { href: "/owner/fleet", labelKey: "nav.fleet", icon: "🛵" },
  { href: "/owner/batteries", labelKey: "nav.batteries", icon: "🔋" },
  { href: "/owner/hub", labelKey: "nav.hub", icon: "🔌" },
  { href: "/owner/tracking", labelKey: "nav.tracking", icon: "🗺️" },
  { href: "/owner/rentals", labelKey: "nav.rentals", icon: "📅" },
  { href: "/owner/incidents", labelKey: "nav.incidents", icon: "🚨" },
  { href: "/owner/insights", labelKey: "nav.insights", icon: "📊" },
  { href: "/owner/notifications", labelKey: "nav.notifications", icon: "🔔" },
];

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "OWNER") redirect("/client");
  return (
    <AppShell nav={NAV} user={{ fullName: session.fullName, role: session.role }}>
      {children}
    </AppShell>
  );
}
