import {
  OrderTable,
  type PortalOrder,
} from "@/components/features/order-table";
import { requireUser } from "@/lib/portal";
import { createSupabaseServerClientWithCookies } from "@/lib/supabaseServer";
export default async function MerchantOrders({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale, true);
  const db = await createSupabaseServerClientWithCookies();
  const { data, error } = await db
    .from("orders")
    .select("*,sku:skus(name)")
    .eq("merchant_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Unable to load merchant orders");
  return (
    <>
      <h1 className="text-3xl font-bold">
        {locale === "zh"
          ? "商户订单（最近 100 条）"
          : "Merchant orders (latest 100)"}
      </h1>
      <OrderTable
        manage
        orders={data as unknown as PortalOrder[]}
        locale={locale}
      />
    </>
  );
}
