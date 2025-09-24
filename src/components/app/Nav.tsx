"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutList, Wallet, Images, CheckSquare, History as TimelineIcon } from "lucide-react";
import { Suspense } from "react";

const links = [
  { href: "/app/board", label: "Board", icon: LayoutList },
  { href: "/app/expenses", label: "Expenses", icon: Wallet },
  { href: "/app/media", label: "Media", icon: Images },
  { href: "/app/checklist", label: "Checklist", icon: CheckSquare },
  { href: "/app/timeline", label: "Timeline", icon: TimelineIcon },
];

function NavLink({ href, label, Icon, variant }: { href: string; label: string; Icon: any; variant: "mobile" | "desktop" }) {
  const pathname = usePathname();
  const active = pathname?.startsWith(href);
  const base = active ? "text-foreground" : "text-muted-foreground";

  if (variant === "mobile") {
    return (
      <Link href={href} className={`flex flex-col items-center justify-center gap-1 px-2 ${base}`} aria-current={active ? "page" : undefined}>
        <Icon className={`h-5 w-5 ${active ? "" : "opacity-80"}`} />
        <span className="text-[11px] leading-none">{label}</span>
      </Link>
    );
  }

  return (
    <Link href={href} className={`flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted ${base}`} aria-current={active ? "page" : undefined}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

export function MobileBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 h-14 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="h-full grid grid-cols-5">
        {links.map(({ href, label, icon: Icon }) => (
          <NavLink key={href} href={href} label={label} Icon={Icon} variant="mobile" />
        ))}
      </div>
    </nav>
  );
}

export function DesktopSidebar() {
  // Lazy import to avoid SSR boundary issues if any
  const UserMenuLazy = (props: any) => {
    const Mod = require("../app/UserMenu");
    return <Mod.UserMenu {...props} />;
  };
  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 shrink-0 border-r min-h-dvh sticky top-0">
      <div className="py-4 px-3 w-full flex flex-col">
        <div className="px-2 pb-3 text-sm font-semibold">Tirupati Trip</div>
        <div className="space-y-1 flex-1">
          {links.map(({ href, label, icon: Icon }) => (
            <NavLink key={href} href={href} label={label} Icon={Icon} variant="desktop" />
          ))}
        </div>
        <div className="pt-2 border-t mt-2">
          <Suspense>
            <UserMenuLazy />
          </Suspense>
        </div>
      </div>
    </aside>
  );
}


