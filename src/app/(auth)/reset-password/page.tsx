"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // when arriving from magic link, recover session
    supabaseBrowser.auth.onAuthStateChange(async (e) => {
      // no-op; supabase-js handles session via URL hash
    });
  }, []);

  async function onUpdate() {
    try {
      setLoading(true);
      const { error } = await supabaseBrowser.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You can sign in now.");
      await fetch("/api/auth/refresh", { cache: "no-store" });
      window.location.href = "/login";
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Set new password</h1>
      <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button onClick={onUpdate} disabled={loading || !password.trim()}>Update password</Button>
    </Card>
  );
}


