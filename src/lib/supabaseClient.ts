import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase-types";

let client: SupabaseClient<Database> | undefined;
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error("Supabase configuration is missing");
  return createBrowserClient<Database>(url, key);
}
export function getSupabaseBrowserClient() {
  client ??= createSupabaseBrowserClient();
  return client;
}
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const instance = getSupabaseBrowserClient();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
export function resetSupabaseBrowserClient() {
  client = undefined;
}
