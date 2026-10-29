"use server";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import type { GameWithSkus } from "@/lib/supabase-types";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
export interface GamesResult {
  success: boolean;
  message: string;
  data?: any;
}
const publicSkuSelection =
  "skus(id,game_id,name,description,prices,image_url,delivery_mode,external_url,requires_recipient_info,recipient_label,created_at,updated_at)";
const selection = `*,${publicSkuSelection}`;

export async function getGames(limit = 20, offset = 0): Promise<GamesResult> {
  const db = createSupabaseServerClient();
  const { data, error, count } = await db
    .from("games")
    .select(selection, { count: "exact" })
    .eq("is_published", true)
    .eq("skus.is_published", true)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw new Error("Unable to load catalogue");
  return {
    success: true,
    message: "Catalogue loaded",
    data: {
      games: data as unknown as GameWithSkus[],
      total: count ?? 0,
      hasMore: (count ?? 0) > offset + limit,
    },
  };
}
export async function getGameByIdServer(id: string): Promise<GamesResult> {
  if (!z.string().uuid().safeParse(id).success)
    return { success: false, message: "Game not found" };
  const db = createSupabaseServerClient();
  const { data, error } = await db
    .from("games")
    .select(selection)
    .eq("id", id)
    .eq("is_published", true)
    .eq("skus.is_published", true)
    .maybeSingle();
  if (error) throw new Error("Unable to load game");
  return {
    success: !!data,
    message: data ? "Game loaded" : "Game not found",
    data,
  };
}
export const getGameById = actionClient
  .schema(z.object({ gameId: z.string().uuid() }))
  .action(({ parsedInput }) => getGameByIdServer(parsedInput.gameId));
export async function getFeaturedGames(limit = 6) {
  const result = await getGames(limit);
  return { ...result, data: result.data.games };
}
export async function getGameSkus(gameId: string) {
  const db = createSupabaseServerClient();
  const { data, error } = await db
    .from("skus")
    .select(
      "id,game_id,name,description,prices,image_url,delivery_mode,external_url,requires_recipient_info,recipient_label,created_at,updated_at",
    )
    .eq("game_id", gameId)
    .eq("is_published", true);
  if (error) throw new Error("Unable to load products");
  return { success: true, message: "Products loaded", data };
}
export const searchGames = actionClient
  .schema(
    z.object({
      query: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().nonnegative().default(0),
    }),
  )
  .action(async ({ parsedInput }) => {
    const db = createSupabaseServerClient();
    let query = db
      .from("games")
      .select(selection, { count: "exact" })
      .eq("is_published", true)
      .eq("skus.is_published", true)
      .order("created_at", { ascending: false });
    if (parsedInput.query?.trim()) {
      const safe = parsedInput.query.replace(/[^\p{L}\p{N} _-]/gu, "").trim();
      query = query.or(`name->>en.ilike.%${safe}%,name->>zh.ilike.%${safe}%`);
    }
    const { data, error, count } = await query.range(
      parsedInput.offset,
      parsedInput.offset + parsedInput.limit - 1,
    );
    if (error) throw new Error("Search unavailable");
    return {
      success: true,
      message: "Search complete",
      data: {
        games: data,
        total: count ?? 0,
        hasMore: (count ?? 0) > parsedInput.offset + parsedInput.limit,
      },
    };
  });
