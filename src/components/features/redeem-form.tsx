"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { redeemCodeAction } from "@/actions/redeem.actions";

export function RedeemForm() {
  const locale = useLocale() as "en" | "zh";
  const zh = locale === "zh";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [playerAccount, setPlayerAccount] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setError("");
    start(async () => {
      try {
        const result = await redeemCodeAction({
          code: code.trim().toUpperCase(),
          buyerEmail: buyerEmail.trim() || undefined,
          playerAccount: playerAccount.trim() || undefined,
          locale,
        });

        if (result?.data?.success && result.data.orderId) {
          router.push(
            `/${locale}/orders/${result.data.orderId}?token=${result.data.accessToken}`,
          );
        } else {
          setError(
            result?.data?.message ||
              (zh
                ? "兑换码无效或已被使用，请检查后重试。"
                : "Invalid or already used redeem code. Please try again."),
          );
        }
      } catch {
        setError(
          zh
            ? "暂时无法连接，请稍后重试。"
            : "Unable to connect. Please retry.",
        );
      }
    });
  };

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
          <span>🎟️</span>
          <span>
            {zh ? "跨平台卡密直兑" : "Cross-platform Code Redemption"}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {zh ? "兑换中心" : "Redemption Center"}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {zh
            ? "在淘宝、闲鱼、小红书等第三方平台购买获得的兑换码，可在此直接核销提货。"
            : "Enter your code purchased from partner platforms to unlock your product instantly."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {zh ? "兑换码 / 卡密 (Redeem Code)" : "Redeem Code"}
            <input
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="NX-XXXX-XXXX-XXXX"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 font-mono text-base uppercase tracking-wider focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {zh
              ? "联系邮箱（接收订单凭据，可选）"
              : "Email (optional for receipt)"}
            <input
              type="email"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="name@example.com"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {zh
              ? "接收账号 / 备注信息（若适用）"
              : "Account / Recipient Info (if applicable)"}
            <input
              value={playerAccount}
              onChange={(e) => setPlayerAccount(e.target.value)}
              placeholder={
                zh ? "如无特殊要求可留空" : "Leave blank if not needed"
              }
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </label>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !code.trim()}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-gray-900 transition-colors"
        >
          {pending
            ? zh
              ? "正在核销…"
              : "Verifying & Redeeming…"
            : zh
              ? "立即核销提货"
              : "Redeem Now"}
        </button>
      </form>
    </div>
  );
}
