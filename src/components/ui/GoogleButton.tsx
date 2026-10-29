"use client";
import { useLocale } from "next-intl";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
export function GoogleButton() {
  const locale = useLocale();
  const zh = locale === "zh";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy}
        className="w-full rounded border p-3"
        onClick={async () => {
          setBusy(true);
          setError(false);
          try {
            const { data, error } =
              await getSupabaseBrowserClient().auth.signInWithOAuth({
                provider: "google",
                options: {
                  redirectTo: `${window.location.origin}/${locale}/auth/callback`,
                },
              });
            if (error || !data.url) setError(true);
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {zh ? "使用 Google 登录" : "Continue with Google"}
      </button>
      {error && (
        <p role="alert">
          {zh
            ? "Google 登录不可用，请使用邮箱登录。"
            : "Google sign-in is unavailable. Use email instead."}
        </p>
      )}
    </div>
  );
}
