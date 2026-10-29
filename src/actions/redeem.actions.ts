"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import {
  createSupabaseAdminClient,
  createSupabaseServerClientWithCookies,
} from "@/lib/supabaseServer";
import { getCurrentUser } from "./auth.actions";

function generateCode(): string {
  // 12-char high-entropy string formatted as NX-XXXX-XXXX-XXXX, avoiding confusing characters (0, O, 1, I)
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(12);
  let res = "";
  for (let i = 0; i < 12; i++) {
    res += alphabet[bytes[i] % alphabet.length];
  }
  return `NX-${res.slice(0, 4)}-${res.slice(4, 8)}-${res.slice(8, 12)}`;
}

export const redeemCodeAction = actionClient
  .schema(
    z.object({
      code: z.string().trim().min(4).max(64),
      skuId: z.string().uuid().optional(),
      buyerEmail: z
        .string()
        .trim()
        .email()
        .max(254)
        .optional()
        .or(z.literal("")),
      playerAccount: z.string().trim().max(128).optional(),
      gameServer: z.string().trim().max(128).optional(),
      locale: z.enum(["en", "zh"]).default("en"),
    }),
  )
  .action(async ({ parsedInput }) => {
    // Current authenticated user (verified session)
    const user = await getCurrentUser();
    // Admin client (service_role) is used because redeem_product_code is revoked from public/anon/authenticated
    const db = createSupabaseAdminClient();
    const zh = parsedInput.locale === "zh";

    try {
      const { data, error } = await db.rpc("redeem_product_code", {
        p_code: parsedInput.code.toUpperCase(),
        p_sku_id: parsedInput.skuId || null,
        // Enforce verified user ID: Never trust client-supplied buyer identity
        p_user_id: user?.id || null,
        p_buyer_email: parsedInput.buyerEmail?.trim() || user?.email || null,
        p_player_account: parsedInput.playerAccount || null,
        p_game_server: parsedInput.gameServer || null,
      });

      if (error) {
        const msg = error.message || "";
        if (msg.includes("INVALID_REDEEM_CODE")) {
          return {
            success: false,
            message: zh
              ? "兑换码无效，请检查后重试。"
              : "Invalid redeem code. Please check and try again.",
          };
        }
        if (msg.includes("CODE_ALREADY_USED")) {
          return {
            success: false,
            message: zh
              ? "该兑换码已被使用。"
              : "This redeem code has already been used.",
          };
        }
        if (msg.includes("CODE_EXPIRED")) {
          return {
            success: false,
            message: zh ? "该兑换码已过期。" : "This redeem code has expired.",
          };
        }
        if (msg.includes("CODE_DISABLED")) {
          return {
            success: false,
            message: zh
              ? "该兑换码已停用。"
              : "This redeem code has been disabled.",
          };
        }
        if (msg.includes("CODE_SKU_MISMATCH")) {
          return {
            success: false,
            message: zh
              ? "该兑换码不适用于当前选择的商品。"
              : "This code is not valid for this product.",
          };
        }
        if (msg.includes("RECIPIENT_INFO_REQUIRED")) {
          return {
            success: false,
            message: zh
              ? "此商品需要填写接收信息/账号。"
              : "Recipient info is required for this item.",
          };
        }
        if (msg.includes("PRODUCT_UNAVAILABLE")) {
          return {
            success: false,
            message: zh
              ? "商品暂不可用或已下架。"
              : "Product is currently unavailable or unpublished.",
          };
        }
        return {
          success: false,
          message: zh
            ? "核销失败，请稍后重试。"
            : "Redemption failed. Please try again later.",
        };
      }

      revalidatePath(`/${parsedInput.locale}/orders`);
      const payload = data as {
        order_id: string;
        access_token: string;
        fulfillment_status: string;
        fulfillment_note: string | null;
        sku_id: string;
      };

      return {
        success: true,
        orderId: payload.order_id,
        accessToken: payload.access_token,
        fulfillmentStatus: payload.fulfillment_status,
        fulfillmentNote: payload.fulfillment_note,
        message: zh ? "兑换成功！" : "Code redeemed successfully!",
      };
    } catch {
      return {
        success: false,
        message: zh
          ? "网络连接异常，请重试。"
          : "Connection error. Please try again.",
      };
    }
  });

export const generateRedeemCodesAction = actionClient
  .schema(
    z.object({
      skuId: z.string().uuid(),
      count: z.number().int().min(1).max(200),
      batchNote: z.string().trim().max(255).optional(),
      customDeliveryContent: z.string().trim().max(2000).optional(),
      customDeliveryContents: z.array(z.string().trim().max(2000)).optional(),
      expiresInDays: z.number().int().min(1).max(3650).optional(),
      locale: z.enum(["en", "zh"]).default("en"),
    }),
  )
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user || user.role === "USER") {
      throw new Error("Merchant or admin access required");
    }

    const db = await createSupabaseServerClientWithCookies();

    // Verify SKU belongs to caller merchant (unless caller is ADMIN)
    const { data: skuRecord, error: skuErr } = await db
      .from("skus")
      .select("id, game_id, games!inner(id, merchant_id)")
      .eq("id", parsedInput.skuId)
      .single();

    if (skuErr || !skuRecord) {
      throw new Error("Product not found");
    }

    const skuMerchantId = (skuRecord as any).games?.merchant_id;
    if (user.role !== "ADMIN" && skuMerchantId !== user.id) {
      throw new Error(
        "Unauthorized to generate codes for another merchant's product",
      );
    }

    const expiresAt = parsedInput.expiresInDays
      ? new Date(
          Date.now() + parsedInput.expiresInDays * 86400000,
        ).toISOString()
      : null;

    const rows = [];
    const generatedCodes: string[] = [];

    for (let i = 0; i < parsedInput.count; i++) {
      const code = generateCode();
      generatedCodes.push(code);

      // Support "一码一密": individual delivery content if list provided, otherwise single custom content
      const individualContent =
        parsedInput.customDeliveryContents?.[i] ||
        parsedInput.customDeliveryContent ||
        null;

      rows.push({
        code,
        sku_id: parsedInput.skuId,
        merchant_id: skuMerchantId || user.id,
        batch_note: parsedInput.batchNote || null,
        custom_delivery_content: individualContent,
        expires_at: expiresAt,
        status: "active" as const,
      });
    }

    const { error } = await db.from("redeem_codes").insert(rows);
    if (error) {
      throw new Error(`Failed to generate codes: ${error.message}`);
    }

    revalidatePath(`/${parsedInput.locale}/dashboard`);
    return {
      success: true,
      count: generatedCodes.length,
      codes: generatedCodes,
    };
  });

export const revokeRedeemCodeAction = actionClient
  .schema(
    z.object({
      codeId: z.string().uuid(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user || user.role === "USER") {
      throw new Error("Merchant or admin access required");
    }

    const db = await createSupabaseServerClientWithCookies();
    const { error } = await db.rpc("revoke_redeem_code", {
      p_code_id: parsedInput.codeId,
    });

    if (error) {
      throw new Error(error.message || "Failed to revoke code");
    }

    return { success: true };
  });

export const getRedeemCodesAction = actionClient
  .schema(
    z.object({
      skuId: z.string().uuid().optional(),
      status: z.enum(["all", "active", "redeemed", "disabled"]).default("all"),
      limit: z.number().int().min(1).max(200).default(50),
    }),
  )
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user || user.role === "USER") {
      throw new Error("Merchant or admin access required");
    }

    const db = await createSupabaseServerClientWithCookies();
    let query = db
      .from("redeem_codes")
      .select("*,sku:skus(id,name,prices)")
      .order("created_at", { ascending: false })
      .limit(parsedInput.limit);

    if (parsedInput.skuId) {
      query = query.eq("sku_id", parsedInput.skuId);
    }
    if (parsedInput.status !== "all") {
      query = query.eq("status", parsedInput.status);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return { success: true, codes: data || [] };
  });
