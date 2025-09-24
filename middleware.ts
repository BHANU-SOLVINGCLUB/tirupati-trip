import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const url = new URL(req.url);
  const isApp = url.pathname.startsWith("/app");
  const isAuth = url.pathname.startsWith("/login") || url.pathname.startsWith("/signup") || url.pathname.startsWith("/forgot-password") || url.pathname.startsWith("/reset-password");

  // Do not hard-block app routes in middleware to avoid redirect loops when
  // server cookies lag behind client session. Client-side layouts will guard.

  if (isAuth && session) {
    const nextParam = url.searchParams.get("next");
    return NextResponse.redirect(new URL(nextParam || "/app", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/", "/app/:path*", "/login", "/signup", "/forgot-password", "/reset-password"],
};


