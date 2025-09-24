import { createClient } from "@supabase/supabase-js";

// Hardcoded Supabase credentials per user request
const supabaseUrl = "https://etujwggdvxnmomthcqth.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0dWp3Z2dkdnhubW9tdGhjcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg3MTU5MDcsImV4cCI6MjA3NDI5MTkwN30.fHKMLUeOuY0KVXo_PvFLGSjGBnYH8Y63UyGJxO6oGak";

export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});


