"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { loginAction, registerAction } from "@/actions/auth.actions";
import { GoogleButton } from "@/components/ui/GoogleButton";
export function AuthForm() {
  const locale = useLocale() as "en" | "zh";
  const zh = locale === "zh";
  const router = useRouter();
  const search = useSearchParams();
  const [login, setLogin] = useState(true);
  const [merchant, setMerchant] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <Link href={`/${locale}`}>{zh ? "返回首页" : "Back to store"}</Link>
      <h1 className="text-3xl font-bold">
        {login ? (zh ? "登录" : "Sign in") : zh ? "注册" : "Create account"}
      </h1>
      {search.get("error") && (
        <p role="alert">
          {zh
            ? "登录未完成，请重试。"
            : "Sign in could not be completed. Please try again."}
        </p>
      )}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          start(async () => {
            try {
              const credentials = {
                email: String(form.get("email")),
                password: String(form.get("password")),
              };
              const result = login
                ? await loginAction(credentials)
                : await registerAction({
                    ...credentials,
                    confirmPassword: String(form.get("confirm")),
                    role: merchant ? "MERCHANT" : "USER",
                    merchantName: String(form.get("merchant") ?? ""),
                    locale,
                  });
              setMessage(
                result.data?.message ??
                  (zh ? "请检查输入并重试。" : "Check your input and retry."),
              );
              if (result.data?.success && result.data.user) {
                router.push(`/${locale}`);
                router.refresh();
              }
            } catch {
              setMessage(
                zh
                  ? "暂时无法连接，请稍后重试。"
                  : "Unable to connect. Please retry later.",
              );
            }
          });
        }}
      >
        <label className="block">
          Email
          <input
            className="mt-1 block w-full rounded border p-2"
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label className="block">
          {zh ? "密码" : "Password"}
          <input
            className="mt-1 block w-full rounded border p-2"
            type="password"
            name="password"
            autoComplete={login ? "current-password" : "new-password"}
            required
            minLength={login ? 1 : 8}
          />
        </label>
        {!login && (
          <>
            <label className="block">
              {zh ? "确认密码" : "Confirm password"}
              <input
                className="mt-1 block w-full rounded border p-2"
                type="password"
                name="confirm"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={merchant}
                onChange={(e) => setMerchant(e.target.checked)}
              />
              {zh ? "注册商户账户" : "Create a merchant account"}
            </label>
            {merchant && (
              <label className="block">
                {zh ? "商户名称" : "Merchant name"}
                <input
                  className="mt-1 block w-full rounded border p-2"
                  name="merchant"
                  required
                  maxLength={255}
                />
              </label>
            )}
          </>
        )}
        <button
          type="submit"
          className="w-full rounded bg-blue-600 p-3 text-white disabled:opacity-50"
          disabled={pending}
        >
          {pending
            ? zh
              ? "处理中…"
              : "Processing…"
            : login
              ? zh
                ? "登录"
                : "Sign in"
              : zh
                ? "注册"
                : "Register"}
        </button>
      </form>
      <p aria-live="polite">{message}</p>
      <button
        type="button"
        onClick={() => {
          setLogin(!login);
          setMessage("");
        }}
      >
        {login
          ? zh
            ? "创建账户"
            : "Create account"
          : zh
            ? "已有账户？登录"
            : "Have an account? Sign in"}
      </button>
      {login && (
        <Link className="block text-blue-700" href={`/${locale}/auth/forgot`}>
          {zh ? "忘记密码？" : "Forgot password?"}
        </Link>
      )}
      <GoogleButton />
    </main>
  );
}
