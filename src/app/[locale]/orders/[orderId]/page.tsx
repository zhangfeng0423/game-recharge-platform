import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderReceiptServer } from "@/actions/order.actions";
import { formatDate, formatPrice } from "@/lib/utils";

export default async function OrderReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; orderId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale, orderId } = await params;
  const { token } = await searchParams;
  const zh = locale === "zh";

  const order = await getOrderReceiptServer(orderId, token);
  if (!order) {
    notFound();
  }

  const sku = (order as any).sku;
  const isFulfilled = order.fulfillment_status === "fulfilled";
  const isRedeem = order.payment_mode === "redeem";

  return (
    <main className="container mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900 space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-5 dark:border-gray-800">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              {isRedeem
                ? zh
                  ? "卡密兑换订单"
                  : "Redeem Order"
                : zh
                  ? "在线购买订单"
                  : "Store Order"}
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              {zh ? "订单回执与交付" : "Order Receipt & Delivery"}
            </h1>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              isFulfilled
                ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
            }`}
          >
            {isFulfilled
              ? zh
                ? "✓ 已交付完成"
                : "✓ Delivered"
              : zh
                ? "⏳ 待人工处理"
                : "⏳ In Progress"}
          </span>
        </div>

        {/* Product & Price Summary */}
        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                {sku?.name?.[locale] || sku?.name?.en || (zh ? "商品" : "Item")}
              </p>
              <p className="text-xs text-gray-500 font-mono mt-1">
                {zh ? "订单号" : "Order ID"}: {order.id}
              </p>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {isRedeem
                ? zh
                  ? "兑换提货"
                  : "Redeemed"
                : formatPrice(order.amount, order.currency, locale)}
            </p>
          </div>
        </div>

        {/* Delivery Content Box */}
        {order.fulfillment_note && (
          <div className="rounded-xl border border-green-200 bg-green-50/70 p-5 dark:border-green-900/50 dark:bg-green-950/30">
            <h2 className="text-sm font-bold text-green-900 dark:text-green-300 mb-2 flex items-center gap-2">
              <span>🎁</span>
              <span>
                {zh
                  ? "交付内容 / 卡密 / 下载链接"
                  : "Delivered Content & Download Links"}
              </span>
            </h2>
            <div className="rounded-lg bg-white p-3 font-mono text-sm break-all select-all dark:bg-gray-900 dark:text-green-400 border border-green-100 dark:border-green-900/30">
              {order.fulfillment_note}
            </div>
            <p className="mt-2 text-xs text-green-700 dark:text-green-400">
              {zh
                ? "请妥善保存上述凭据，你也可以随时通过当前链接或在「我的订单」中查看。"
                : "Please save the content above. You can revisit this receipt anytime."}
            </p>
          </div>
        )}

        {!isFulfilled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            {zh
              ? "该订单已成功受理，管理员正在人工处理中，处理完成后交付内容会在此处显示。"
              : "Payment confirmed. Our team is processing your order manually; details will appear here once delivered."}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div>
            <span className="block font-medium text-gray-700 dark:text-gray-300">
              {zh ? "下单时间" : "Created At"}
            </span>
            <span>{formatDate(order.created_at, locale)}</span>
          </div>
          {order.buyer_email && (
            <div>
              <span className="block font-medium text-gray-700 dark:text-gray-300">
                {zh ? "联系邮箱" : "Buyer Email"}
              </span>
              <span>{order.buyer_email}</span>
            </div>
          )}
        </div>

        <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Link
            href={`/${locale}`}
            className="flex-1 text-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            {zh ? "返回商城首页" : "Back to Store"}
          </Link>
          <Link
            href={`/${locale}/orders`}
            className="flex-1 text-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            {zh ? "我的全部订单" : "View All Orders"}
          </Link>
        </div>
      </div>
    </main>
  );
}
