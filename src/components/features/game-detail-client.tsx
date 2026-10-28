"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SkuCard } from "@/components/features/sku-card";
import { SkuDetailModal } from "@/components/features/sku-detail-modal";
import type { GameWithSkus, Sku } from "@/lib/supabase-types";
import { useSkuModalStore } from "@/stores/useSkuModalStore";

interface GameDetailClientProps {
  testMode?: boolean;
  game: GameWithSkus;
  locale: string;
  skuCardTranslations: {
    popular: string;
    rechargeButton: string;
  };
}

export function GameDetailClient({
  game,
  locale,
  testMode = false,
  skuCardTranslations,
}: GameDetailClientProps) {
  const t = useTranslations("common");
  const { openModal } = useSkuModalStore();

  const handleViewDetails = (sku: Sku) => {
    openModal(sku);
  };

  const gameName = game.name[locale as keyof typeof game.name] || game.name.en;
  const gameDescription =
    game.description?.[locale as keyof typeof game.description] ||
    game.description?.en ||
    "";

  return (
    <>
      <SkuDetailModal testMode={testMode} />
      <div className="min-h-screen bg-gray-50">
        {/* Navigation Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Back Button + Game Title */}
              <div className="flex items-center space-x-4">
                <Link
                  href={`/${locale}`}
                  className="text-gray-600 hover:text-gray-900 flex items-center space-x-1"
                >
                  <span>←</span>
                  <span>{t("back")}</span>
                </Link>
                <h1 className="text-xl font-semibold text-gray-900">
                  {gameName}
                </h1>
              </div>

              {/* Right side controls */}
              <div className="flex items-center space-x-6">
                {/* Language Toggle */}
                <div className="flex items-center space-x-2 text-sm">
                  <Link
                    href={`/en/games/${game.id}`}
                    className={`px-2 py-1 rounded ${
                      locale === "en"
                        ? "bg-[#359EFF]/20 text-[#359EFF]"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    EN
                  </Link>
                  <span className="text-gray-400">/</span>
                  <Link
                    href={`/zh/games/${game.id}`}
                    className={`px-2 py-1 rounded ${
                      locale === "zh"
                        ? "bg-[#359EFF]/20 text-[#359EFF]"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    ZH
                  </Link>
                </div>

                {/* User */}
                <div className="text-sm text-[#359EFF] font-medium"></div>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Large Game Banner at top */}
          <div className="mb-8">
            <div className="relative w-full h-64 md:h-96 bg-gray-100 rounded-lg overflow-hidden">
              {game.banner_url ? (
                <Image
                  src={game.banner_url}
                  alt={gameName}
                  fill
                  className="object-cover"
                  priority
                  loading="eager"
                  sizes="100vw"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <span className="text-white text-6xl font-bold">
                    {gameName.charAt(0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Game Description and separator */}
          {gameDescription && (
            <div className="mb-8">
              <p className="text-lg text-gray-700 max-w-4xl">
                {gameDescription}
              </p>
              <div className="max-w-4xl h-px bg-gray-300 mt-4"></div>
            </div>
          )}

          {/* SKU Selection Section */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8">
              {t("selectYourItem")}
            </h2>

            {/* SKU Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {game.skus?.map((sku) => (
                <SkuCard
                  key={sku.id}
                  sku={sku}
                  locale={locale}
                  onViewDetails={handleViewDetails}
                  translations={skuCardTranslations}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
