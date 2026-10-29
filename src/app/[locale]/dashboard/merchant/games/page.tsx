import {
  CatalogueEditor,
  type RedeemCodeSummary,
} from "@/components/features/merchant/catalogue-editor";
import { requireUser } from "@/lib/portal";
import type { GameWithSkus } from "@/lib/supabase-types";
import { createSupabaseServerClientWithCookies } from "@/lib/supabaseServer";
export default async function MerchantGames({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale, true);
  const db = await createSupabaseServerClientWithCookies();
  const [{ data, error }, codes] = await Promise.all([
    db
      .from("games")
      .select("*,skus(*,sku_fulfillment_secrets(content))")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .from("redeem_codes")
      .select("id,sku_id,code,status,batch_note,order_id")
      .eq("merchant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (error || codes.error) throw new Error("Unable to load products or codes");

  const formattedGames = ((data as any[]) || []).map((g) => ({
    ...g,
    skus: (g.skus || []).map((s: any) => ({
      ...s,
      auto_delivery_content:
        s.sku_fulfillment_secrets?.content ||
        (Array.isArray(s.sku_fulfillment_secrets)
          ? s.sku_fulfillment_secrets[0]?.content
          : "") ||
        "",
    })),
  }));

  return (
    <CatalogueEditor
      games={formattedGames as unknown as GameWithSkus[]}
      redeemCodes={(codes.data || []) as RedeemCodeSummary[]}
      locale={locale as "en" | "zh"}
    />
  );
}
