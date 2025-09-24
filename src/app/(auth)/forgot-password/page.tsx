"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function onReset() {
    try {
      setLoading(true);
      const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined,
      });
      if (error) throw error;
      toast.success("Password reset email sent");
    } catch (e: any) {
      toast.error(e.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Forgot password</h1>
      <div className="space-y-2">
        <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button className="w-full" onClick={onReset} disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Remembered it? <Link href="/login" className="underline">Back to sign in</Link>
      </p>
    </Card>
  );
}


