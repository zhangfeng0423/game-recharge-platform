import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getGameByIdServer } from "@/actions/games.actions";
import { GameDetailClient } from "@/components/features/game-detail-client";
import type { GameWithSkus } from "@/lib/supabase-types";

interface GameDetailPageProps {
  params: Promise<{
    locale: string;
    gameId: string;
  }>;
}

export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { locale, gameId } = await params;

  const gameResult = await getGameByIdServer(gameId);

  if (!gameResult.success || !gameResult.data) {
    notFound();
  }

  const game = gameResult.data as GameWithSkus;

  // Get translations for SkuCard components
  const tGames = await getTranslations("games");

  const skuCardTranslations = {
    popular: tGames("popular"),
    rechargeButton: tGames("rechargeButton"),
  };

  return (
    <GameDetailClient
      game={game}
      locale={locale}
      skuCardTranslations={skuCardTranslations}
    />
  );
}
