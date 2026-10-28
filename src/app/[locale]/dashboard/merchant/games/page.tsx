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
    .select("*,skus(*)")
    .eq("merchant_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load products");
  return (
    <CatalogueEditor
      games={data as unknown as GameWithSkus[]}
      locale={locale as "en" | "zh"}
    />
  );
}
