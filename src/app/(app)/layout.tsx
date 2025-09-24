"use client";
import Link from "next/link";
import { DesktopSidebar, MobileBottomNav } from "@/components/app/Nav";
import { UserMenu } from "@/components/app/UserMenu";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      if (!active) return;
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-dvh flex">
      <DesktopSidebar />
      <div className="flex-1 flex flex-col">
        <header className="md:hidden sticky top-0 z-40 bg-background/80 backdrop-blur border-b">
          <div className="h-14 flex items-center justify-between px-4">
            <Link href="/app/board" className="font-semibold">Tirupati Trip</Link>
            <UserMenu />
          </div>
        </header>
        <main className="container mx-auto px-4 py-4 flex-1 pb-16 md:pb-4">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}


