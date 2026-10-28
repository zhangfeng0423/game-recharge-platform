"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { createCheckoutSession } from "@/actions/payment.actions";
import { formatPrice } from "@/lib/utils";
import { useSkuModalStore } from "@/stores/useSkuModalStore";
export function SkuDetailModal() {
  const locale = useLocale() as "en" | "zh";
  const zh = locale === "zh";
  const { isOpen, sku, closeModal } = useSkuModalStore();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [playerAccount, setPlayerAccount] = useState("");
  const [gameServer, setGameServer] = useState("");
  if (!sku) return null;
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeModal();
          setError("");
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-5 rounded-2xl bg-white p-6 shadow-xl">
          <Dialog.Title className="text-2xl font-bold">
            {sku.name[locale]}
          </Dialog.Title>
          <Dialog.Description className="whitespace-pre-wrap">
            {sku.description?.[locale] ??
              (zh
                ? "请确认商品与价格后继续。"
                : "Review the item and price before continuing.")}
          </Dialog.Description>
          <p className="text-3xl font-bold">
            {formatPrice(sku.prices.usd, "usd", locale)}
          </p>
          <p className="text-sm">
            {zh
              ? "付款后由人工处理充值，请核对游戏 ID 与区服，切勿填写密码。"
              : "Recharge is processed manually after payment. Verify your game ID and server. Never enter a password."}
          </p>
          <label className="block">
            {zh ? "游戏 ID" : "Player account ID"}
            <input
              className="block w-full rounded border p-2"
              value={playerAccount}
              onChange={(e) => setPlayerAccount(e.target.value)}
              required
              maxLength={128}
            />
          </label>
          <label className="block">
            {zh
              ? "区服（不适用请填 N/A）"
              : "Game server (enter N/A if not applicable)"}
            <input
              className="block w-full rounded border p-2"
              value={gameServer}
              onChange={(e) => setGameServer(e.target.value)}
              required
              maxLength={128}
            />
          </label>
          <button
            type="button"
            disabled={pending || !playerAccount.trim() || !gameServer.trim()}
            className="w-full rounded bg-blue-600 p-3 text-white disabled:opacity-50"
            onClick={() => {
              setError("");
              start(async () => {
                try {
                  const result = await createCheckoutSession({
                    skuId: sku.id,
                    playerAccount,
                    gameServer,
                    locale,
                  });
                  if (result.data?.success && result.data.checkoutUrl)
                    window.location.assign(result.data.checkoutUrl);
                  else
                    setError(
                      result.data?.message ??
                        (zh
                          ? "暂时无法下单，请确认已登录。"
                          : "Unable to check out. Please ensure you are signed in."),
                    );
                } catch {
                  setError(
                    zh
                      ? "下单失败，请稍后重试。"
                      : "Unable to check out. Please retry later.",
                  );
                }
              });
            }}
          >
            {pending
              ? zh
                ? "处理中…"
                : "Processing…"
              : zh
                ? "前往支付"
                : "Continue to payment"}
          </button>
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
          <Dialog.Close asChild>
            <button type="button" className="w-full p-2">
              {zh ? "关闭" : "Close"}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
