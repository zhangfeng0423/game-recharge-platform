"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-3xl font-bold">
        {reset
          ? zh
            ? "设置新密码"
            : "Set a new password"
          : zh
            ? "找回密码"
            : "Reset your password"}
      </h1>
      <p>
        {reset
          ? zh
            ? "新密码至少 8 位。请自行输入，不要向他人发送。"
            : "Use at least 8 characters. Enter it yourself; do not share it."
          : zh
            ? "输入注册邮箱，我们会发送重置链接。"
            : "Enter your account email to request a reset link."}
      </p>
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
              setMessage(
                result.data?.message ??
                  (zh ? "请检查输入并重试。" : "Check your input and retry."),
              );
              if (reset && result.data?.success) {
                router.replace(`/${locale}`);
                router.refresh();
              }
            } catch {
              setMessage(
                zh
                  ? "暂时无法连接，请稍后重试。"
                  : "Unable to connect. Retry later.",
              );
            }
          });
        }}
      >
        {reset ? (
          <>
            <label className="block">
              {zh ? "新密码" : "New password"}
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                className="mt-1 block w-full rounded border p-2"
              />
            </label>
            <label className="block">
              {zh ? "确认新密码" : "Confirm new password"}
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                className="mt-1 block w-full rounded border p-2"
              />
            </label>
          </>
        ) : (
          <label className="block">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className="mt-1 block w-full rounded border p-2"
            />
          </label>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-blue-600 p-3 text-white disabled:opacity-50"
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
      <p aria-live="polite">{message}</p>
      <Link href={`/${locale}/auth`}>
        {zh ? "返回登录" : "Back to sign in"}
      </Link>
    </main>
  );
}
