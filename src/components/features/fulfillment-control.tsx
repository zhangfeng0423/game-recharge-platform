"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fulfillOrder } from "@/actions/fulfillment.actions";
export function FulfillmentControl({
  orderId,
  locale,
  testMode = false,
}: {
  orderId: string;
  locale: "en" | "zh";
  testMode?: boolean;
}) {
  const zh = locale === "zh";
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <form
      className="min-w-64 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        if (form.get("confirmed") !== "on") return;
        start(async () => {
          try {
            const result = await fulfillOrder({
              orderId,
              locale,
              status:
                form.get("status") === "attention" ? "attention" : "fulfilled",
              note: String(form.get("note")),
              confirmed: true,
            });
            if (result.data?.success) {
              router.refresh();
            } else
              setMessage(
                zh
                  ? "处理失败，请确认权限和支付状态。"
                  : "Unable to update. Check permission and payment status.",
              );
          } catch {
            setMessage(
              zh ? "处理失败，请重试。" : "Update failed. Please retry.",
            );
          }
        });
      }}
    >
      {testMode && (
        <p className="text-amber-700">
          {zh
            ? "测试／未核实订单：只验证后台流程，勿进行真实充值。"
            : "Test / unverified order: simulate the workflow only; do not deliver real goods."}
        </p>
      )}
      <label className="block">
        {zh ? "处理结果" : "Delivery result"}
        <select name="status" className="block w-full rounded border p-2">
          <option value="fulfilled">
            {zh ? "已完成人工充值" : "Recharge delivered"}
          </option>
          <option value="attention">
            {zh ? "需要跟进" : "Needs follow-up"}
          </option>
        </select>
      </label>
      <label className="block">
        {zh
          ? "给买家的交付说明／凭证号"
          : "Delivery note / reference (visible to buyer)"}
        <input
          name="note"
          className="block w-full rounded border p-2"
          required
          maxLength={1000}
        />
      </label>
      <label className="flex gap-2">
        <input type="checkbox" name="confirmed" required />
        {zh
          ? "我已核实实际处理结果"
          : "I have verified the actual delivery result"}
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-blue-600 p-2 text-white"
      >
        {zh ? "保存处理结果" : "Save delivery result"}
      </button>
      <p aria-live="polite">{message}</p>
    </form>
  );
}
