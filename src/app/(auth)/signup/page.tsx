"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    try {
      setLoading(true);
      const { error } = await supabaseBrowser.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/app` : undefined,
        },
      });
      if (error) throw error;
      toast.success("Check your email to confirm your account");
      await fetch("/api/auth/refresh", { cache: "no-store" });
    } catch (e: any) {
      toast.error(e.message ?? "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <div className="space-y-2">
        <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button className="w-full" onClick={onSignup} disabled={loading}>
          {loading ? "Creating..." : "Sign up"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Already have an account? <Link href="/login" className="underline">Sign in</Link>
      </p>
    </Card>
  );
}


