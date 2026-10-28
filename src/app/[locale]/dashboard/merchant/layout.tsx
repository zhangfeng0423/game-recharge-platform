import Link from "next/link";
import { requireUser } from "@/lib/portal";
export default async function MerchantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await requireUser(locale, true);
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <nav className="flex flex-wrap gap-5 border-b pb-4">
        <Link href={`/${locale}`}>
          {locale === "zh" ? "返回首页" : "Store"}
        </Link>
        <Link href={`/${locale}/dashboard/merchant`}>
          {locale === "zh" ? "概览" : "Overview"}
        </Link>
        <Link href={`/${locale}/dashboard/merchant/games`}>
          {locale === "zh" ? "游戏与商品" : "Games & products"}
        </Link>
        <Link href={`/${locale}/dashboard/merchant/orders`}>
          {locale === "zh" ? "订单" : "Orders"}
        </Link>
      </nav>
      {children}
    </main>
  );
}
