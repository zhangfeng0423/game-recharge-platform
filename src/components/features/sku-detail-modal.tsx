"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { createCheckoutSession } from "@/actions/payment.actions";
import { redeemCodeAction } from "@/actions/redeem.actions";
import { formatPrice } from "@/lib/utils";
import { useSkuModalStore } from "@/stores/useSkuModalStore";

export function SkuDetailModal({ testMode = false }: { testMode?: boolean }) {
  const locale = useLocale() as "en" | "zh";
  const zh = locale === "zh";
  const router = useRouter();
  const { isOpen, sku, closeModal } = useSkuModalStore();
  const [activeTab, setActiveTab] = useState<"checkout" | "redeem">("checkout");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [playerAccount, setPlayerAccount] = useState("");
  const [gameServer, setGameServer] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [redeemCode, setRedeemCode] = useState("");

  if (!sku) return null;

  const isShowcase = (sku as any).delivery_mode === "showcase";
  const isAuto = (sku as any).delivery_mode === "auto";
  const requiresInfo =
    (sku as any).requires_recipient_info ||
    (sku as any).delivery_mode === "manual" ||
    !(sku as any).delivery_mode;

  const handleCheckout = () => {
    setError("");
    start(async () => {
      try {
        const result = await createCheckoutSession({
          skuId: sku.id,
          playerAccount: requiresInfo ? playerAccount : undefined,
          gameServer: requiresInfo ? gameServer : undefined,
          buyerEmail: buyerEmail.trim() || undefined,
          locale,
        });
        if (result.data?.success && result.data.checkoutUrl) {
          window.location.assign(result.data.checkoutUrl);
        } else {
          setError(
            result.data?.message ??
              (zh
                ? "暂时无法拉起支付，请重试。"
                : "Unable to start checkout. Please retry."),
          );
        }
      } catch {
        setError(
          zh
            ? "下单失败，请稍后重试。"
            : "Unable to check out. Please retry later.",
        );
      }
    });
  };

  const handleRedeem = () => {
    if (!redeemCode.trim()) return;
    setError("");
    start(async () => {
      try {
        const result = await redeemCodeAction({
          code: redeemCode.trim().toUpperCase(),
          skuId: sku.id,
          buyerEmail: buyerEmail.trim() || undefined,
          playerAccount: requiresInfo ? playerAccount : undefined,
          gameServer: requiresInfo ? gameServer : undefined,
          locale,
        });

        if (result?.data?.success && result.data.orderId) {
          closeModal();
          router.push(
            `/${locale}/orders/${result.data.orderId}?token=${result.data.accessToken}`,
          );
        } else {
          setError(
            result?.data?.message ||
              (zh
                ? "兑换码无效或已被使用。"
                : "Invalid or already used redeem code."),
          );
        }
      } catch {
        setError(
          zh
            ? "兑换核销失败，请稍后重试。"
            : "Redemption failed. Please try again.",
        );
      }
    });
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeModal();
          setError("");
          setActiveTab("checkout");
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <div>
            <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
              {sku.name[locale] || sku.name.en}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {sku.description?.[locale] ??
                sku.description?.en ??
                (zh
                  ? "确认商品规格与交付方式"
                  : "Select payment or redemption method")}
            </Dialog.Description>
          </div>

          <div className="flex items-baseline justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {formatPrice(sku.prices.usd, "usd", locale)}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isAuto
                  ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
              }`}
            >
              {isAuto
                ? zh
                  ? "⚡ 自动发货"
                  : "⚡ Instant Delivery"
                : zh
                  ? "🛠 人工履约"
                  : "🛠 Manual Delivery"}
            </span>
          </div>

          {testMode && (
            <p className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50">
              {zh
                ? "当前为测试模式，不发生真实扣款与发货。"
                : "Payment test mode: no real money charged."}
            </p>
          )}

          {isShowcase ? (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {zh
                  ? "该商品为外链展示模式，点击下方按钮前往对应平台查看或购买。"
                  : "This product is available via partner platform. Click below to view details."}
              </p>
              <a
                href={(sku as any).external_url || "#"}
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                {zh ? "前往外部平台查看" : "View on External Platform"}
              </a>
            </div>
          ) : (
            <>
              {/* Mode Tabs */}
              <div className="grid grid-cols-2 rounded-xl bg-gray-100 p-1 text-xs font-semibold dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("checkout");
                    setError("");
                  }}
                  className={`rounded-lg py-2 transition-all ${
                    activeTab === "checkout"
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  💳 {zh ? "在线购买 (Stripe)" : "Buy with Card"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("redeem");
                    setError("");
                  }}
                  className={`rounded-lg py-2 transition-all ${
                    activeTab === "redeem"
                      ? "bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400"
                      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                  }`}
                >
                  🎟️ {zh ? "兑换码提货" : "Redeem Code"}
                </button>
              </div>

              {/* Form Content */}
              <div className="space-y-3 pt-1">
                {activeTab === "redeem" ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                      {zh ? "输入兑换码 / 卡密" : "Redeem Code"}
                      <input
                        required
                        placeholder="NX-XXXX-XXXX-XXXX"
                        value={redeemCode}
                        onChange={(e) =>
                          setRedeemCode(e.target.value.toUpperCase())
                        }
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase font-mono tracking-wider focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    </label>
                  </div>
                ) : null}

                {requiresInfo && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        {zh ? "游戏 ID" : "Player account ID"}
                        <input
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          value={playerAccount}
                          onChange={(e) => setPlayerAccount(e.target.value)}
                          required
                          maxLength={128}
                        />
                      </label>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        {zh
                          ? "区服（不适用请填 N/A）"
                          : "Game server (enter N/A if not applicable)"}
                        <input
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          value={gameServer}
                          onChange={(e) => setGameServer(e.target.value)}
                          required
                          maxLength={128}
                        />
                      </label>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                    {zh
                      ? "联系邮箱（接收凭据与订单通知）"
                      : "Email (for receipt)"}
                    <input
                      type="email"
                      placeholder="name@example.com"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={
                    pending ||
                    (activeTab === "redeem" && !redeemCode.trim()) ||
                    (requiresInfo &&
                      (!playerAccount.trim() || !gameServer.trim()))
                  }
                  className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  onClick={
                    activeTab === "checkout" ? handleCheckout : handleRedeem
                  }
                >
                  {pending
                    ? zh
                      ? "处理中…"
                      : "Processing…"
                    : activeTab === "checkout"
                      ? zh
                        ? "前往支付"
                        : "Continue to payment"
                      : zh
                        ? "核销并提货"
                        : "Redeem Now"}
                </button>
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <Dialog.Close asChild>
            <button
              type="button"
              className="w-full text-center text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 py-1"
            >
              {zh ? "关闭" : "Close"}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
