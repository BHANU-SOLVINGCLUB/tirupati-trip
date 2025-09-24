import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    "https://etujwggdvxnmomthcqth.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dWp3Z2dkdnhubW9tdGhjcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MTU5MDcsImV4cCI6MjA3NDI5MTkwN30.fHKMLUeOuY0KVXo_PvFLGSjGBnYH8Y63UyGJxO6oGak",
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: any) {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );
}


