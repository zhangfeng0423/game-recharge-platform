"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import { createSupabaseServerClientWithCookies } from "@/lib/supabaseServer";
import { getCurrentUser } from "./auth.actions";

const text = z.string().trim().min(1).max(1000);
const image = z
  .union([
    z.literal(""),
    z.url().refine((v) => v.startsWith("https://"), "Use HTTPS"),
  ])
  .optional();
const names = z.object({ en: text, zh: text });
const context = z.object({ locale: z.enum(["en", "zh"]) });
async function merchantDb() {
  const user = await getCurrentUser();
  if (!user || user.role === "USER")
    throw new Error("Merchant access required");
  return { db: await createSupabaseServerClientWithCookies(), user };
}
export const saveGame = actionClient
  .schema(
    context.extend({
      id: z.uuid().optional(),
      name: names,
      description: names,
      banner_url: image,
    }),
  )
  .action(async ({ parsedInput }) => {
    const { db, user } = await merchantDb();
    const { id, locale, ...fields } = parsedInput;
    const payload = {
      ...fields,
      banner_url: fields.banner_url || null,
      merchant_id: user.id,
    };
    const query = id
      ? db.from("games").update(payload).eq("id", id).eq("merchant_id", user.id)
      : db.from("games").insert(payload);
    const { data, error } = await query.select("id").single();
    if (error || !data) throw new Error("Unable to save game");
    revalidatePath(`/${locale}`);
    revalidatePath(`/${locale}/dashboard/merchant/games`);
    return { success: true, id: data.id };
  });
export const deleteGame = actionClient
  .schema(context.extend({ id: z.uuid() }))
  .action(async ({ parsedInput }) => {
    const { db, user } = await merchantDb();
    const { data, error } = await db
      .from("games")
      .delete()
      .eq("id", parsedInput.id)
      .eq("merchant_id", user.id)
      .select("id")
      .single();
    if (error || !data)
      throw new Error(
        "Unable to delete game. Products with orders must be retained.",
      );
    revalidatePath(`/${parsedInput.locale}`);
    revalidatePath(`/${parsedInput.locale}/dashboard/merchant/games`);
    return { success: true };
  });
export const saveSku = actionClient
  .schema(
    context.extend({
      id: z.uuid().optional(),
      game_id: z.uuid(),
      name: names,
      description: names,
      amount: z.number().int().min(50).max(999999),
      image_url: image,
    }),
  )
  .action(async ({ parsedInput }) => {
    const { db, user } = await merchantDb();
    const { data: game, error: gameError } = await db
      .from("games")
      .select("id")
      .eq("id", parsedInput.game_id)
      .eq("merchant_id", user.id)
      .single();
    if (gameError || !game) throw new Error("Game not found");
    const { id, locale, amount, ...fields } = parsedInput;
    const payload = {
      ...fields,
      prices: { usd: amount },
      image_url: fields.image_url || null,
    };
    const query = id
      ? db.from("skus").update(payload).eq("id", id).eq("game_id", game.id)
      : db.from("skus").insert(payload);
    const { data, error } = await query.select("id").single();
    if (error || !data) throw new Error("Unable to save product");
    revalidatePath(`/${locale}/games/${game.id}`);
    revalidatePath(`/${locale}/dashboard/merchant/games`);
    return { success: true };
  });
export const deleteSku = actionClient
  .schema(context.extend({ id: z.uuid(), game_id: z.uuid() }))
  .action(async ({ parsedInput }) => {
    const { db, user } = await merchantDb();
    const { data: game } = await db
      .from("games")
      .select("id")
      .eq("id", parsedInput.game_id)
      .eq("merchant_id", user.id)
      .single();
    if (!game) throw new Error("Game not found");
    const { data, error } = await db
      .from("skus")
      .delete()
      .eq("id", parsedInput.id)
      .eq("game_id", game.id)
      .select("id")
      .single();
    if (error || !data)
      throw new Error("Unable to delete a product with order history");
    revalidatePath(`/${parsedInput.locale}/games/${game.id}`);
    revalidatePath(`/${parsedInput.locale}/dashboard/merchant/games`);
    return { success: true };
  });
