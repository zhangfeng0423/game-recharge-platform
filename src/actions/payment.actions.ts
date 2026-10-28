"use server";
import { z } from "zod";
import { actionClient } from "@/lib/action-client";
import { getAppOrigin } from "@/lib/app-origin";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";
import { getCurrentUser } from "./auth.actions";
export const createCheckoutSession = actionClient
  .schema(
    z.object({
      skuId: z.string().uuid(),
      playerAccount: z.string().trim().min(1).max(128),
      gameServer: z.string().trim().min(1).max(128),
      locale: z.enum(["en", "zh"]),
    }),
  )
  .action(async ({ parsedInput }) => {
    const user = await getCurrentUser();
    if (!user)
      return { success: false, message: "Please sign in before purchasing." };
    if (
      process.env.PAYMENTS_ENABLED !== "true" ||
      !process.env.STRIPE_WEBHOOK_SECRET?.trim()
    )
      return {
        success: false,
        message: "Checkout is not available yet. Please check back later.",
      };
    const stripe = getStripe();
    const origin = getAppOrigin();
    const db = createSupabaseAdminClient();
    // All order amounts and merchant IDs come from the database, never the browser.
    const { data: sku, error } = await db
      .from("skus")
      .select("*,games!inner(id,merchant_id)")
      .eq("id", parsedInput.skuId)
      .single();
    if (error || !sku)
      return { success: false, message: "Product is unavailable." };
    const product = sku as unknown as {
      id: string;
      game_id: string;
      name: { en: string; zh: string };
      prices: { usd: number };
      games: { id: string; merchant_id: string };
    };
    const amount = product.prices.usd;
    if (!Number.isSafeInteger(amount) || amount < 50 || amount > 999999)
      return { success: false, message: "Invalid product price." };
    const { data: order, error: orderError } = await db
      .from("orders")
      .insert({
        user_id: user.id,
        player_account: parsedInput.playerAccount,
        game_server: parsedInput.gameServer,
        sku_id: product.id,
        merchant_id: product.games.merchant_id,
        amount,
        currency: "usd",
        payment_mode: process.env.STRIPE_SECRET_KEY?.trim().startsWith(
          "sk_test_",
        )
          ? "test"
          : "live",
        status: "pending",
      })
      .select("id")
      .single();
    if (orderError || !order) throw new Error("Unable to create order");
    let sessionId: string | undefined;
    try {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          allowed_payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: amount,
                product_data: {
                  name: product.name[parsedInput.locale] || product.name.en,
                },
              },
              quantity: 1,
            },
          ],
          client_reference_id: order.id,
          metadata: { orderId: order.id, userId: user.id },
          customer_email: user.email || undefined,
          success_url: `${origin}/${parsedInput.locale}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/${parsedInput.locale}/payment/cancel`,
        },
        { idempotencyKey: `checkout:${order.id}` },
      );
      sessionId = session.id;
      if (!session.url) throw new Error("Missing checkout URL");
      const result = await db
        .from("orders")
        .update({ stripe_checkout_session_id: session.id })
        .eq("id", order.id)
        .eq("status", "pending")
        .select("id")
        .single();
      if (result.error || !result.data)
        throw new Error("Unable to attach checkout session");
      return {
        success: true,
        message: "Checkout ready",
        checkoutUrl: session.url,
      };
    } catch (error) {
      // If expiry cannot be confirmed, retain the pending order for reconciliation.
      // Never mark an uncertain payment as failed or return an unbound checkout URL.
      let safeToFail = !sessionId;
      if (sessionId) {
        try {
          await stripe.checkout.sessions.expire(sessionId);
          safeToFail = true;
        } catch {
          console.error("Checkout needs reconciliation", { orderId: order.id });
        }
      }
      if (safeToFail)
        await db
          .from("orders")
          .update({ status: "failed" })
          .eq("id", order.id)
          .eq("status", "pending");
      console.error("Checkout creation failed", {
        orderId: order.id,
        error: error instanceof Error ? error.name : "Unknown",
      });
      return {
        success: false,
        message: "Checkout could not be created. Please try again later.",
      };
    }
  });
