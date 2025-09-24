import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    "https://etujwggdvxnmomthcqth.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dWp3Z2dkdnhubW9tdGhjcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MTU5MDcsImV4cCI6MjA3NDI5MTkwN30.fHKMLUeOuY0KVXo_PvFLGSjGBnYH8Y63UyGJxO6oGak",
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );
  // Trigger server to read session and set cookies
  await supabase.auth.getSession();
  return res;
}


