import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/actions/auth.actions";
import {
  getOrderBySessionAndTokenServer,
  getOrderBySessionIdServer,
} from "@/actions/order.actions";
import { PaymentRefresh } from "@/components/features/payment-refresh";
import { formatPrice } from "@/lib/utils";

export default async function PaymentSuccess({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string; token?: string }>;
}) {
  const { locale } = await params;
  const { session_id, token } = await searchParams;
  if (!session_id) notFound();

  const user = await getCurrentUser();
  // Support both logged in user or verified guest token
  let order = null;
  if (user) {
    order = await getOrderBySessionIdServer(session_id);
  }
  if (!order && token) {
    order = await getOrderBySessionAndTokenServer(session_id, token);
  }

  const zh = locale === "zh";
  if (!order) notFound();

  const paid = order.status === "completed";
  const pending = order.status === "pending";
  const fulfilled = order.fulfillment_status === "fulfilled";

  return (
    <main className="container mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6">
        <PaymentRefresh pending={pending} />
        <div className="flex items-center gap-3">
          <span className="text-3xl">{paid ? "🎉" : pending ? "⏳" : "⚠️"}</span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {paid
              ? zh
                ? "支付已确认"
                : "Payment confirmed"
              : pending
                ? zh
                  ? "等待支付确认"
                  : "Awaiting payment confirmation"
                : zh
                  ? "支付未完成"
                  : "Payment not completed"}
          </h1>
        </div>

        {order.payment_mode !== "live" && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50">
            {zh
              ? "测试／未核实订单，不代表真实扣款，仅供流程验证。"
              : "Test / unverified order. This does not represent a real charge."}
          </p>
        )}

        {/* Fulfillment Note if Auto-Fulfilled */}
        {fulfilled && order.fulfillment_note && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/30">
            <p className="text-xs font-bold text-green-900 dark:text-green-300 mb-1">
              {zh
                ? "🎁 自动发货凭据 / 下载链接："
                : "🎁 Delivered Items / Download Links:"}
            </p>
            <div className="rounded bg-white p-2.5 font-mono text-xs break-all select-all dark:bg-gray-900 dark:text-green-400">
              {order.fulfillment_note}
            </div>
          </div>
        )}

        <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <p>
            {pending
              ? zh
                ? "正在等待支付平台回调通知，页面会自动刷新。你也可以稍后在订单页查看。"
                : "Waiting for the payment provider. This page refreshes automatically."
              : fulfilled
                ? zh
                  ? "商品已自动交付完成！你可保存上方凭证，或在订单页随时查阅。"
                  : "Your items have been delivered automatically."
                : zh
                  ? "支付已成功，管理员正在人工处理中，你可在订单页查看交付状态。"
                  : "Payment confirmed. Manual recharge in progress."}
          </p>
          <p className="font-mono text-xs text-gray-400 pt-2">
            {zh ? "订单号" : "Order ID"}: {order.id}
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white pt-1">
            {formatPrice(order.amount, order.currency, locale)}
          </p>
        </div>

        <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Link
            href={`/${locale}/orders/${order.id}${order.access_token ? `?token=${order.access_token}` : ""}`}
            className="flex-1 text-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            {zh ? "查看订单详情" : "View Order Receipt"}
          </Link>
          <Link
            href={`/${locale}`}
            className="flex-1 text-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 transition-colors"
          >
            {zh ? "继续逛逛" : "Back to Store"}
          </Link>
        </div>
      </div>
    </main>
  );
}
