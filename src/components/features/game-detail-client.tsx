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
      <div className="min-h-screen">
        {/* Breadcrumb Bar */}
        <div className="border-b border-gray-200/80 bg-white/60 dark:border-gray-800/80 dark:bg-gray-900/60 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-3 sm:px-6">
            <Link
              href={`/${locale}`}
              className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white inline-flex items-center gap-1.5 transition-colors"
            >
              <span>←</span>
              <span>{t("back")}</span>
            </Link>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 sm:px-6 max-w-6xl space-y-8">
          {/* Hero Banner Card */}
          <div className="relative w-full h-56 sm:h-80 rounded-3xl overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 shadow-md">
            {game.banner_url ? (
              <Image
                src={game.banner_url}
                alt={gameName}
                fill
                className="object-cover"
                priority
                loading="eager"
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-white text-6xl font-bold opacity-80">
                  {gameName.charAt(0)}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-6 sm:p-8">
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm">
                {gameName}
              </h1>
            </div>
          </div>

          {/* Description */}
          {gameDescription && (
            <div className="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {gameDescription}
              </p>
            </div>
          )}

          {/* SKU Selection Grid */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t("selectYourItem")}
            </h2>

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
