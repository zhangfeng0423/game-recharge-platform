import { CatalogueEditor } from "@/components/features/merchant/catalogue-editor";
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
  const { data, error } = await db
    .from("games")
    .select("*,skus(*,sku_fulfillment_secrets(content))")
    .eq("merchant_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load products");

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
      locale={locale as "en" | "zh"}
    />
  );
}
