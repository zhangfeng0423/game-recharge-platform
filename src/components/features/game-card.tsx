import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { GameWithSkus } from "@/lib/supabase-types";
import { formatPrice } from "@/lib/utils";

interface GameCardProps {
  game: GameWithSkus;
  locale: string;
  translations: {
    itemsAvailable: string;
    fromPrice: string;
    gameDetails: string;
    noGamesFound: string;
  };
}

export function GameCard({ game, locale, translations }: GameCardProps) {
  const t = useTranslations("games");
  const zh = locale === "zh";
  const gameName = game.name[locale as keyof typeof game.name] || game.name.en;
  const gameDesc =
    game.description?.[locale as keyof typeof game.description] ||
    game.description?.en ||
    "";

  const minPrice =
    game.skus.length > 0
      ? Math.min(...game.skus.map((s) => s.prices?.usd ?? 999999))
      : null;

  const hasAuto = game.skus.some(
    (s: any) => s.delivery_mode === "auto" || !s.delivery_mode,
  );

  return (
    <Link
      href={`/${locale}/games/${game.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-blue-500/40 dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Banner / Cover */}
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
        {game.banner_url ? (
          <Image
            src={game.banner_url}
            alt={gameName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="eager"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-1">📦</div>
              <p className="text-xs font-medium text-gray-400">
                {t("noImage")}
              </p>
            </div>
          </div>
        )}

        {/* Delivery Badge */}
        <div className="absolute top-3 left-3 flex gap-1.5">
          {hasAuto ? (
            <span className="rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
              {zh ? "⚡ 自动发货" : "⚡ Instant"}
            </span>
          ) : (
            <span className="rounded-full bg-blue-500/90 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm">
              {zh ? "🛠 手工履约" : "🛠 Manual"}
            </span>
          )}
        </div>
      </div>

      {/* Info Container */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold tracking-tight text-gray-900 group-hover:text-blue-600 transition-colors dark:text-white dark:group-hover:text-blue-400">
              {gameName}
            </h3>
          </div>
          {gameDesc && (
            <p className="mt-1.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
              {gameDesc}
            </p>
          )}
        </div>

        {/* Pricing & SKU count footer */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
          <div>
            {minPrice !== null && minPrice < 999999 ? (
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] text-gray-400">
                  {zh ? "起售价" : "From"}
                </span>
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  {formatPrice(minPrice, "usd", locale)}
                </span>
              </div>
            ) : (
              <span className="text-gray-400">{t("noItemsAvailable")}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
            <span>
              {translations.itemsAvailable.replace(
                "{count}",
                game.skus.length.toString(),
              )}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
