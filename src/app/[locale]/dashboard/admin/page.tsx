import {
  OrderTable,
  type PortalOrder,
} from "@/components/features/order-table";
import { requireUser } from "@/lib/portal";
import { createSupabaseServerClientWithCookies } from "@/lib/supabaseServer";
export default async function Admin({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser(locale, false, true);
  const db = await createSupabaseServerClientWithCookies();
  const [profiles, orders] = await Promise.all([
    db.from("profiles").select("id,role,merchant_name").limit(100),
    db
      .from("orders")
      .select("*,sku:skus(name)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (profiles.error || orders.error)
    throw new Error("Unable to load platform overview");
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-3xl font-bold">
        {locale === "zh" ? "平台管理" : "Platform administration"}
      </h1>
      <h2>
        {locale === "zh" ? "账户（最多 100 个）" : "Accounts (up to 100)"}
      </h2>
      <ul>
        {profiles.data.map((p) => (
          <li key={p.id} className="border-b p-2">
            {p.merchant_name ?? p.id} · {p.role}
          </li>
        ))}
      </ul>
      <h2>{locale === "zh" ? "最近 100 条订单" : "Latest 100 orders"}</h2>
      <OrderTable
        manage
        orders={orders.data as unknown as PortalOrder[]}
        locale={locale}
      />
    </main>
  );
}
