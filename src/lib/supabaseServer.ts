import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./supabase-types";

function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) throw new Error("Supabase public configuration is missing");
  return { url, key };
}

// Public catalogue reads must never silently bypass RLS.
export function createSupabaseServerClient() {
  const { url, key } = publicConfig();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Reserved for verified payment processing and server-controlled profile creation.
export function createSupabaseAdminClient() {
  const { url } = publicConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) throw new Error("Supabase service configuration is missing");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function createSupabaseServerClientWithCookies() {
  const { url, key } = publicConfig();
  const store = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(values) {
        // Server Components cannot write cookies; proxy.ts handles session refresh there.
        try {
          for (const { name, value, options } of values)
            store.set(name, value, options);
        } catch {
          /* Cookie writes are allowed in Actions and Route Handlers only. */
        }
      },
    },
  });
}
export const createSupabaseClientForServerActions =
  createSupabaseServerClientWithCookies;
export const getSupabaseServerClient = createSupabaseServerClient;
export const getSupabaseAdminClient = createSupabaseAdminClient;
