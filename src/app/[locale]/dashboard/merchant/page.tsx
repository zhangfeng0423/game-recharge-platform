import { requireUser } from "@/lib/portal";
import { createSupabaseServerClientWithCookies } from "@/lib/supabaseServer";
import { formatPrice } from "@/lib/utils";
export default async function MerchantDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale, true);
  const db = await createSupabaseServerClientWithCookies();
  const [games, orders] = await Promise.all([
    db
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", user.id),
    db
      .from("orders")
      .select("amount,status")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  if (games.error || orders.error)
    throw new Error("Unable to load merchant overview");
  const total =
    orders.data
      ?.filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + o.amount, 0) ?? 0;
  const zh = locale === "zh";
  return (
    <>
      <h1 className="text-3xl font-bold">
        {zh ? "商户概览" : "Merchant overview"}
      </h1>
      <dl className="grid gap-6 sm:grid-cols-3">
        {[
          [zh ? "游戏" : "Games", games.count ?? 0],
          [
            zh ? "最近订单（最多 1000 条）" : "Recent orders (up to 1000)",
            orders.data?.length ?? 0,
          ],
          [
            zh ? "这些订单的已收款金额" : "Paid revenue in these orders",
            formatPrice(total, "usd", locale),
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded border p-6">
            <dt>{label}</dt>
            <dd className="mt-3 text-3xl">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
