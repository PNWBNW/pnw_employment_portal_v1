"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/src/lib/utils";
import { useEmployerIdentityStore } from "@/src/stores/employer_identity_store";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";

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

interface EmployerNavProps {
  /** Whether the mobile drawer is open */
  mobileOpen?: boolean;
  /** Called when the mobile drawer should close */
  onMobileClose?: () => void;
}

export function EmployerNav({ mobileOpen, onMobileClose }: EmployerNavProps) {
  const pathname = usePathname();
  const { address } = useAleoSession();
  const {
    businesses,
    activeBusinessIndex,
    setActiveBusiness,
  } = useEmployerIdentityStore();

  // Compute active business directly (Zustand getters aren't reactive)
  const activeBusiness = activeBusinessIndex !== null ? businesses[activeBusinessIndex] ?? null : null;

  // Only show businesses with completed profiles
  const completedBusinesses = businesses.filter(b => b.profileAnchored);
  const hasMultiple = completedBusinesses.length > 1;

  const navContent = (
    <nav className="flex h-full w-56 flex-col border-r border-border bg-card">
      {/* Header with .pnw identity */}
      <div className="border-b border-border px-4 py-3">
        <span className="text-sm font-bold tracking-tight text-primary">
          PNW Portal
        </span>
        {activeBusiness ? (
          <div className="mt-2">
            <p className="text-sm font-semibold text-foreground">
              {/^[a-z0-9_]{3,16}$/.test(activeBusiness.name)
                ? `${activeBusiness.name}.pnw`
                : activeBusiness.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {INDUSTRY_SUFFIXES[activeBusiness.suffixCode]?.label ?? "Business"}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground truncate">
            {address ? `${address.slice(0, 10)}...${address.slice(-6)}` : "Not connected"}
          </p>
        )}
      </div>

      {/* Business switcher (only if multiple completed businesses) */}
      {hasMultiple && (
        <div className="border-b border-border px-3 py-2">
          <label className="text-xs font-medium text-muted-foreground">
            Active Business
          </label>
          <select
            value={activeBusinessIndex ?? 0}
            onChange={(e) => setActiveBusiness(Number(e.target.value))}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {businesses.map((biz, i) => (
              biz.profileAnchored && (
                <option key={biz.nameHash} value={i}>
                  {/^[a-z0-9_]{3,16}$/.test(biz.name) ? `${biz.name}.pnw` : biz.name}
                </option>
              )
            ))}
          </select>
        </div>
      )}

      <div className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
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
        {address && (
          <p className="mt-1 font-mono text-xs text-muted-foreground truncate">
            {address.slice(0, 10)}...{address.slice(-6)}
          </p>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar — always visible at md+ */}
      <div className="hidden md:flex">{navContent}</div>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop — closes menu on tap */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onMobileClose}
          />
          {/* Drawer panel */}
          <div className="relative z-10">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
