import Link from "next/link";
import { formatDate, formatPrice } from "@/lib/utils";
import { FulfillmentControl } from "./fulfillment-control";
export interface PortalOrder {
  player_account?: string | null;
  game_server?: string | null;
  fulfillment_status?: string;
  fulfillment_note?: string | null;
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  sku: {
    name: { en: string; zh: string };
    game?: { name: { en: string; zh: string } };
  } | null;
}
export function OrderTable({
  orders,
  locale,
  manage = false,
}: {
  orders: PortalOrder[];
  locale: string;
  manage?: boolean;
}) {
  const zh = locale === "zh";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {(zh
              ? [
                  "订单号",
                  "商品",
                  "金额",
                  "支付状态",
                  "日期",
                  "玩家 ID／区服",
                  "交付状态",
                ]
              : [
                  "Order",
                  "Product",
                  "Amount",
                  "Payment status",
                  "Date",
                  "Player / server",
                  "Delivery status",
                ]
            ).map((x) => (
              <th key={x} className="border-b p-3">
                {x}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td className="border-b p-3 font-mono">{o.id}</td>
              <td className="border-b p-3">
                {o.sku?.name[zh ? "zh" : "en"] ?? "—"}
              </td>
              <td className="border-b p-3">
                {formatPrice(o.amount, o.currency, locale)}
              </td>
              <td className="border-b p-3">
                {o.status === "completed"
                  ? zh
                    ? "已收款"
                    : "Paid"
                  : o.status === "failed"
                    ? zh
                      ? "已失效／失败"
                      : "Expired / failed"
                    : zh
                      ? "待支付确认"
                      : "Awaiting payment confirmation"}
              </td>
              <td className="border-b p-3">
                {formatDate(o.created_at, locale)}
              </td>
              <td className="border-b p-3">
                {o.player_account ?? "—"} / {o.game_server ?? "—"}
              </td>
              <td className="border-b p-3">
                <p>
                  {o.fulfillment_status === "fulfilled"
                    ? zh
                      ? "充值已完成"
                      : "Delivered"
                    : o.fulfillment_status === "attention"
                      ? zh
                        ? "需跟进"
                        : "Needs follow-up"
                      : zh
                        ? "待人工充值"
                        : "Awaiting manual recharge"}
                </p>
                {o.fulfillment_note && <p>{o.fulfillment_note}</p>}
                {manage &&
                  o.status === "completed" &&
                  o.fulfillment_status !== "fulfilled" && (
                    <FulfillmentControl
                      orderId={o.id}
                      locale={locale as "en" | "zh"}
                    />
                  )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <p className="py-8">{zh ? "暂无订单。" : "No orders yet."}</p>
      )}
      <p className="py-4 text-sm text-slate-500">
        {zh
          ? "已收款仅表示支付已确认，游戏内充值交付需另行确认。"
          : "Paid means payment confirmed. In-game delivery must be confirmed separately."}
      </p>
      <Link href={`/${locale}`}>{zh ? "返回首页" : "Back to store"}</Link>
    </div>
  );
}
