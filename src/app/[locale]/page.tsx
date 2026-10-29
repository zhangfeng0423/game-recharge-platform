import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getGames } from "@/actions/games.actions";
import { GameCard } from "@/components/features/game-card";
import { siteConfig } from "@/config/site";
import type { GameWithSkus } from "@/lib/supabase-types";

interface HomePageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    search?: string;
  }>;
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const zh = locale === "zh";

  try {
    const gamesResult = await getGames();
    const games = (gamesResult.success && gamesResult.data?.games) || [];

    const t = await getTranslations("games");
    const gameCardTranslations = {
      itemsAvailable: t.raw("itemsAvailable"),
      fromPrice: t.raw("fromPrice"),
      gameDetails: t("gameDetails"),
      noGamesFound: t("noGamesFound"),
    };

    const hero = siteConfig.hero[zh ? "zh" : "en"];

    return (
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:py-12">
        {/* Modern SaaS Hero Banner */}
        <section className="relative mb-12 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 px-6 py-12 text-center text-white shadow-xl sm:px-12 sm:py-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.3),transparent_50%)]" />
          <div className="relative mx-auto max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-300 backdrop-blur-sm">
              <span>✨</span>
              <span>{hero.badge}</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              {hero.title}
            </h1>

            <p className="mx-auto max-w-xl text-sm sm:text-base text-blue-100/80 leading-relaxed">
              {hero.subtitle}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href="#products"
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
              >
                {hero.browseButton}
              </a>
              <Link
                href={`/${locale}/redeem`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
              >
                <span>🎟️</span>
                <span>{hero.redeemButton}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Product Catalog Grid */}
        <section id="products" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                {zh ? "精选商品与服务" : "Featured Products & Services"}
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {zh
                  ? `共 ${games.length} 个分类项目`
                  : `${games.length} catalog items available`}
              </p>
            </div>
          </div>

          {games.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
              <p className="text-gray-500 text-sm">
                {gameCardTranslations.noGamesFound}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game: GameWithSkus) => (
                <GameCard
                  key={game.id}
                  game={game}
                  locale={locale}
                  translations={gameCardTranslations}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    );
  } catch (error) {
    console.error("HomePage error:", error);
    const tError = await getTranslations("errors");

    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {tError("generic.errorOccurred")}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {tError("generic.tryAgain")}
          </p>
          <Link
            href={`/${locale}`}
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {tError("generic.tryAgain")}
          </Link>
        </div>
      </div>
    );
  }
}
