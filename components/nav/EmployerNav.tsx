"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/src/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/workers", label: "Workers", icon: "users" },
  { href: "/payroll", label: "Payroll", icon: "banknote" },
  { href: "/credentials", label: "Credentials", icon: "shield" },
  { href: "/audit", label: "Audit", icon: "file-search" },
] as const;

// Simple SVG icons to avoid external dependency for nav
function NavIcon({ name }: { name: string }) {
  const iconMap: Record<string, string> = {
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
    banknote: "M2 6h20v12H2zM12 12a2 2 0 100-4 2 2 0 000 4z",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    "file-search": "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M11.5 16.5L15 20M13 14a3 3 0 11-6 0 3 3 0 016 0z",
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={iconMap[name] ?? ""} />
    </svg>
  );
}

export function EmployerNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-sm font-bold tracking-tight text-primary">
          PNW Portal
        </span>
      </div>

      <div className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-border p-3">
        <p className="text-xs text-muted-foreground">
          Testnet
        </p>
      </div>
    </nav>
  );
}
