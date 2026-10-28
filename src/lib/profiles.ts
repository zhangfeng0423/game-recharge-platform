import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "./supabaseServer";
export async function ensureProfile(user: User) {
  const db = createSupabaseAdminClient();
  let { data, error } = await db
    .from("profiles")
    .select("role,merchant_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Unable to load profile");
  if (!data) {
    // Never infer privileges from an email address or request body.
    const result = await db
      .from("profiles")
      .upsert(
        { id: user.id, role: "USER", merchant_name: null },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (result.error) throw new Error("Unable to create profile");
    ({ data, error } = await db
      .from("profiles")
      .select("role,merchant_name")
      .eq("id", user.id)
      .single());
    if (error || !data) throw new Error("Unable to load profile");
  }
  return data;
}
