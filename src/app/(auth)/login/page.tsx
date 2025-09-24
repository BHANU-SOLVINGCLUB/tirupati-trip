"use client";
import { Suspense, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const search = useSearchParams();
  const next = search?.get("next") || "/app";

  // Do not auto-redirect on the client; rely on middleware to avoid loops when
  // client has a stale local session without server cookies.

  async function onEmailPassword() {
    try {
      setLoading(true);
      const { error } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success("Logged in");
      // Call server route to sync cookies before navigating
      await fetch("/api/auth/refresh", { cache: "no-store" });
      window.location.href = next;
    } catch (e: any) {
      toast.error(e.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <div className="space-y-2">
        <Input
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button className="w-full" onClick={onEmailPassword} disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </Button>
      </div>
      <div className="text-sm text-muted-foreground flex items-center justify-between">
        <Link href="/signup" className="underline">Create account</Link>
        <Link href="/forgot-password" className="underline">Forgot password?</Link>
      </div>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}


