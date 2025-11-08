import type { User as SupabaseUser, Session as SupabaseSession } from "@supabase/supabase-js";

// Re-export Supabase types for convenience
export type User = SupabaseUser;
export type Session = SupabaseSession;