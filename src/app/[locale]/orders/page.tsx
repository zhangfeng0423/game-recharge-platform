import {
  OrderTable,
  type PortalOrder,
} from "@/components/features/order-table";
import { requireUser } from "@/lib/portal";
import { createSupabaseServerClientWithCookies } from "@/lib/supabaseServer";
export default async function OrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);
  const db = await createSupabaseServerClientWithCookies();
  const { data, error } = await db
    .from("orders")
    .select("*,sku:skus(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Unable to load orders");
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="mb-6 text-3xl font-bold">
        {locale === "zh" ? "我的订单（最近 100 条）" : "My orders (latest 100)"}
      </h1>
      <OrderTable orders={data as unknown as PortalOrder[]} locale={locale} />
    </main>
  );
}
