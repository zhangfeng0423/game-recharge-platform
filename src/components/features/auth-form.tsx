"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { loginAction, registerAction } from "@/actions/auth.actions";
import { GoogleButton } from "@/components/ui/GoogleButton";
import { siteConfig } from "@/config/site";

export function AuthForm() {
  const locale = useLocale() as "en" | "zh";
  const zh = locale === "zh";
  const router = useRouter();
  const search = useSearchParams();
  const [login, setLogin] = useState(true);
  const [merchant, setMerchant] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {login
              ? zh
                ? "登录账户"
                : "Sign In"
              : zh
                ? "创建账户"
                : "Create Account"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {login
              ? zh
                ? "登录以查看你的订单与交付凭据"
                : "Sign in to manage your orders and receipts"
              : zh
                ? "注册一个新账户"
                : "Register a new buyer account"}
          </p>
        </div>

        {search.get("error") && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
          >
            {zh
              ? "登录未完成，请重试。"
              : "Sign in could not be completed. Please try again."}
          </div>
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
                const ok = result.data?.success ?? false;
                setIsSuccess(ok);
                setMessage(
                  result.data?.message ??
                    (zh ? "请检查输入并重试。" : "Check your input and retry."),
                );
                if (ok && result.data?.user) {
                  router.push(`/${locale}`);
                  router.refresh();
                }
              } catch {
                setIsSuccess(false);
                setMessage(
                  zh
                    ? "暂时无法连接服务器，请稍后重试。"
                    : "Unable to connect. Please retry later.",
                );
              }
            });
          }}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
              <input
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                type="email"
                name="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="name@example.com"
              />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {zh ? "密码" : "Password"}
              <input
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                type="password"
                name="password"
                autoComplete={login ? "current-password" : "new-password"}
                required
                minLength={login ? 1 : 8}
              />
            </label>
          </div>

          {!login && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {zh ? "确认密码" : "Confirm Password"}
                  <input
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    type="password"
                    name="confirm"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </label>
              </div>

              {siteConfig.allowMerchantSignup && (
                <>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={merchant}
                      onChange={(e) => setMerchant(e.target.checked)}
                    />
                    <span>
                      {zh ? "申请成为入驻商户" : "Register as merchant"}
                    </span>
                  </label>
                  {merchant && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {zh ? "商户名称" : "Merchant Name"}
                        <input
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          name="merchant"
                          required
                          maxLength={255}
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
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

        {message && (
          <p
            aria-live="polite"
            className={`text-sm ${
              isSuccess
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {message}
          </p>
        )}

        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            onClick={() => {
              setLogin(!login);
              setMessage("");
            }}
          >
            {login
              ? zh
                ? "还没有账号？立即注册"
                : "Need an account? Register"
              : zh
                ? "已有账号？直接登录"
                : "Already registered? Sign in"}
          </button>

          {login && (
            <Link
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              href={`/${locale}/auth/forgot`}
            >
              {zh ? "忘记密码？" : "Forgot password?"}
            </Link>
          )}
        </div>

        <div className="pt-2">
          <GoogleButton />
        </div>
      </div>
    </main>
  );
}
