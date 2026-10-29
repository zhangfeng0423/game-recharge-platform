"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import {
  requestPasswordReset,
  updatePassword,
} from "@/actions/password.actions";

export function PasswordForm({ reset = false }: { reset?: boolean }) {
  const locale = useLocale() as "en" | "zh";
  const zh = locale === "zh";
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {reset
              ? zh
                ? "设置新密码"
                : "Set a new password"
              : zh
                ? "找回密码"
                : "Reset your password"}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {reset
              ? zh
                ? "新密码至少 8 位，请妥善保管。"
                : "Must be at least 8 characters. Keep it secure."
              : zh
                ? "输入你的注册邮箱，我们会向你发送重置链接。"
                : "Enter your account email and we will send you a reset link."}
          </p>
        </div>

        {urlError === "expired" && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
          >
            {zh
              ? "重置链接已失效或过期，请重新申请重置邮件。"
              : "This reset link is invalid or expired. Please request a new one."}
          </div>
        )}

        <form
          className="space-y-4"
          action={(form: FormData) => {
            start(async () => {
              try {
                const result = reset
                  ? await updatePassword({
                      password: String(form.get("password")),
                      confirmPassword: String(form.get("confirm")),
                    })
                  : await requestPasswordReset({
                      email: String(form.get("email")),
                      locale,
                    });
                const ok = result.data?.success ?? false;
                setIsSuccess(ok);
                setMessage(
                  result.data?.message ??
                    (zh ? "请检查输入并重试。" : "Check your input and retry."),
                );
                if (reset && ok) {
                  setTimeout(() => {
                    router.replace(`/${locale}`);
                    router.refresh();
                  }, 1500);
                }
              } catch {
                setIsSuccess(false);
                setMessage(
                  zh
                    ? "暂时无法连接服务器，请稍后重试。"
                    : "Unable to connect. Retry later.",
                );
              }
            });
          }}
        >
          {reset ? (
            <>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {zh ? "新密码" : "New password"}
                </span>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {zh ? "确认新密码" : "Confirm new password"}
                </span>
                <input
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </label>
            </>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="name@example.com"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-900 transition-colors"
          >
            {pending
              ? zh
                ? "处理中…"
                : "Processing…"
              : reset
                ? zh
                  ? "保存新密码"
                  : "Save new password"
                : zh
                  ? "发送重置邮件"
                  : "Send reset email"}
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

        <div className="pt-2 text-center text-sm">
          <Link
            href={`/${locale}/auth`}
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            {zh ? "← 返回登录" : "← Back to sign in"}
          </Link>
        </div>
      </div>
    </main>
  );
}
