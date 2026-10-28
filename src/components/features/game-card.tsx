import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { GameWithSkus } from "@/lib/supabase-types";

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
  // Get the localized game name
  const gameName = game.name[locale as keyof typeof game.name] || game.name.en;

  return (
    <Link
      href={`/${locale}/games/${game.id}`}
      className="group relative overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-200 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800 block cursor-pointer"
    >
      {/* Game Banner - Full width at the top with 3:2 aspect ratio */}
      <div className="relative w-full aspect-[3/2] overflow-hidden bg-gray-100 dark:bg-gray-700">
        {game.banner_url ? (
          <Image
            src={game.banner_url}
            alt={gameName}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="100vw"
            loading="eager"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-2 text-4xl">🎮</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("noImage")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Game Info - Below the image */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {gameName}
            </h3>
            {game.merchant_name && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                by {game.merchant_name}
              </p>
            )}
          </div>

          {/* SKUs info - Price removed */}
          <div className="flex items-center space-x-2">
            {game.skus.length > 0 ? (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {translations.itemsAvailable.replace(
                    "{count}",
                    game.skus.length.toString(),
                  )}
                </p>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("noItemsAvailable")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
