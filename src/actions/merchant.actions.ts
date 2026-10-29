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
      delivery_mode: z.enum(["auto", "manual", "showcase"]).default("auto"),
      auto_delivery_content: z.string().trim().max(2000).optional(),
      external_url: image,
      requires_recipient_info: z.boolean().default(false),
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

    if (
      parsedInput.delivery_mode === "auto" &&
      !parsedInput.auto_delivery_content?.trim()
    ) {
      throw new Error(
        parsedInput.locale === "zh"
          ? "自动发货模式必须填写发货凭据/内容"
          : "Delivery secret content is required for auto fulfillment mode",
      );
    }

    const { error: saveError } = await db.rpc("save_sku_with_secret", {
      p_id: parsedInput.id || null,
      p_game_id: parsedInput.game_id,
      p_name: parsedInput.name,
      p_description: parsedInput.description,
      p_prices: { usd: parsedInput.amount },
      p_image_url: parsedInput.image_url || null,
      p_delivery_mode: parsedInput.delivery_mode,
      p_external_url: parsedInput.external_url || null,
      p_requires_recipient_info: parsedInput.requires_recipient_info,
      p_recipient_label: {
        en: "Recipient / Account Info",
        zh: "接收账号 / 备注信息",
      },
      p_is_published: true,
      p_secret_content: parsedInput.auto_delivery_content?.trim() || null,
    });

    if (saveError) {
      throw new Error(`Unable to save product: ${saveError.message}`);
    }

    revalidatePath(`/${parsedInput.locale}/games/${game.id}`);
    revalidatePath(`/${parsedInput.locale}/dashboard/merchant/games`);
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
