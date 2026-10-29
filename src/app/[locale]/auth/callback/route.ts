import { NextResponse } from "next/server";
import { ensureProfile } from "@/lib/profiles";
import { createSupabaseClientForServerActions } from "@/lib/supabaseServer";
export async function GET(
  request: Request,
  context: { params: Promise<{ locale: string }> },
) {
  const { locale: requestedLocale } = await context.params;
  const locale = requestedLocale === "zh" ? "zh" : "en";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  if (tokenHash && url.searchParams.get("type") === "recovery") {
    const db = await createSupabaseClientForServerActions();
    const { error } = await db.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (!error)
      return NextResponse.redirect(
        new URL(`/${locale}/auth/reset`, url.origin),
      );
    return NextResponse.redirect(
      new URL(`/${locale}/auth/forgot?error=expired`, url.origin),
    );
  }
  if (code) {
    const db = await createSupabaseClientForServerActions();
    const { data, error } = await db.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await ensureProfile(data.user);
      const next = url.searchParams.get("next");
      // Only allow local, locale-scoped destinations, without an alternate authority.
      const target =
        next?.startsWith(`/${locale}/`) && !next.includes("\\")
          ? next
          : `/${locale}`;
      return NextResponse.redirect(new URL(target, url.origin));
    }
  }
  return NextResponse.redirect(
    new URL(`/${locale}/auth?error=Authentication%20failed`, url.origin),
  );
}
