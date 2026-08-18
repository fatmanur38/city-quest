import { serverEnv } from "@/lib/env";
import { MemoryDatabase } from "./memory";
import { SupabaseDatabase } from "./supabase";
import type { Database } from "./types";

export type { Database } from "./types";
export * from "./types";

let instance: Database | null = null;

/**
 * Postgres when it is configured, a local JSON file when it is not.
 *
 * Keeping both behind one interface means a fresh clone runs immediately, while a deployment
 * with SUPABASE_URL set gets real Postgres without a single call site changing.
 */
export function db(): Database {
  if (instance) return instance;
  const env = serverEnv();
  if (env.supabaseUrl && env.supabaseServiceRoleKey) {
    instance = new SupabaseDatabase(env.supabaseUrl, env.supabaseServiceRoleKey);
    console.log("[db] using Supabase");
  } else {
    instance = new MemoryDatabase();
    console.log("[db] SUPABASE_URL not set - using local JSON store (.data/cityquest.json)");
  }
  return instance;
}
