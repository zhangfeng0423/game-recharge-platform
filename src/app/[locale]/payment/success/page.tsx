import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderBySessionIdServer } from "@/actions/order.actions";
import { PaymentRefresh } from "@/components/features/payment-refresh";
import { requireUser } from "@/lib/portal";
import { formatPrice } from "@/lib/utils";
export default async function PaymentSuccess({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { locale } = await params;
  await requireUser(locale);
  const { session_id } = await searchParams;
  if (!session_id) notFound();
  const order = await getOrderBySessionIdServer(session_id);
  const zh = locale === "zh";
  if (!order) notFound();
  const paid = order.status === "completed";
  const pending = order.status === "pending";
  return (
    <section className="mx-auto max-w-xl space-y-5 p-6">
      <PaymentRefresh pending={pending} />
      <h1 className="text-3xl font-bold">
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
      <p>
        {pending
          ? zh
            ? "正在等待支付平台回调，页面会自动刷新。你也可以稍后在订单页查看。"
            : "Waiting for the payment provider. This page refreshes automatically; you can also check your orders later."
          : zh
            ? "支付确认后等待人工充值，你可在订单页查看交付状态。"
            : "After payment is confirmed, recharge is processed manually. Check delivery status in your orders."}
      </p>
      <p>
        {zh ? "订单号" : "Order"}: {order.id}
      </p>
      <p>{formatPrice(order.amount, order.currency, locale)}</p>
      <Link href={`/${locale}/orders`}>
        {zh ? "查看我的订单" : "View my orders"}
      </Link>
    </section>
  );
}
