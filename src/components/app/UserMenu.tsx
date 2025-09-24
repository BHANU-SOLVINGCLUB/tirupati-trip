"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function UserMenu() {
  const [loading, setLoading] = useState(false);
  async function signOut() {
    try {
      setLoading(true);
      await supabaseBrowser.auth.signOut();
      await fetch("/api/auth/refresh", { cache: "no-store" });
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={signOut} disabled={loading} className="text-sm text-muted-foreground hover:text-foreground">
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}


