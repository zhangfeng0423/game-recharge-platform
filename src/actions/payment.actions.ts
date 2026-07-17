"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSafeActionClient } from "next-safe-action";
import Stripe from "stripe";
import { z } from "zod";
import type { Database } from "@/lib/supabase-types";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getCurrentUser } from "./auth.actions";

function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  return secretKey
    ? new Stripe(secretKey, {
        apiVersion: "2024-06-20" as any,
        typescript: true,
        telemetry: false,
      })
    : null;
}

// Constants for error handling and validation
const MINIMUM_AMOUNT_CENTS = 50; // $0.50 minimum
const MAXIMUM_AMOUNT_CENTS = 999999; // $9,999.99 maximum
const _SUPPORTED_CURRENCIES = ["usd"]; // V1 is USD only as per PRD

// Create the action client
const actionClient = createSafeActionClient({
  handleServerError: (e: unknown) => {
    console.error("Action Error:", e);
    return {
      serverError: "An unexpected error occurred.",
    };
  },
});

// Enhanced validation schema with security checks
const checkoutSchema = z.object({
  skuId: z.string().min(1, "SKU ID is required"),
  locale: z.enum(["en", "zh"]),
});

// Action result
export interface CheckoutResult {
  success: boolean;
  message: string;
  checkoutUrl?: string;
}

// Helper function for logging payment events
function logPaymentEvent(
  level: "info" | "warn" | "error",
  message: string,
  data?: any,
) {
  const timestamp = new Date().toISOString();
  console[level](
    `[PAYMENT] ${timestamp} - ${message}`,
    data ? JSON.stringify(data, null, 2) : "",
  );
}

// Helper function to validate price
function validatePrice(priceInCents: number): {
  valid: boolean;
  error?: string;
} {
  if (typeof priceInCents !== "number" || !Number.isInteger(priceInCents)) {
    return { valid: false, error: "Price must be an integer value in cents" };
  }

  if (priceInCents < MINIMUM_AMOUNT_CENTS) {
    return {
      valid: false,
      error: `Minimum amount is $${(MINIMUM_AMOUNT_CENTS / 100).toFixed(2)}`,
    };
  }

  if (priceInCents > MAXIMUM_AMOUNT_CENTS) {
    return {
      valid: false,
      error: `Maximum amount is $${(MAXIMUM_AMOUNT_CENTS / 100).toFixed(2)}`,
    };
  }

  return { valid: true };
}

// Create Checkout Session action with enhanced security and error handling
export const createCheckoutSession = actionClient
  .schema(checkoutSchema)
  .action(async ({ parsedInput }): Promise<CheckoutResult> => {
    const startTime = Date.now();
    logPaymentEvent("info", "Starting checkout session creation", {
      skuId: parsedInput.skuId,
      locale: parsedInput.locale,
    });

    let user: any = null;
    
    try {
      const stripe = getStripeClient();
      if (!stripe) {
        return {
          success: false,
          message: "Payment service is not configured.",
        };
      }

      // Use the same authentication method as login functionality
      user = await getCurrentUser();

      // Create supabase client after user authentication check
      const supabase: SupabaseClient<Database> = createSupabaseServerClient();

      // Authentication check
      if (!user) {
        logPaymentEvent("warn", "Checkout attempt by unauthenticated user");
        return {
          success: false,
          message: "User not authenticated. Please log in to continue.",
        };
      }

      logPaymentEvent("info", "User authenticated", { userId: user.id });

      // 1. Get SKU details with enhanced error handling
      const { data: sku, error: skuError } = (await supabase
        .from("skus")
        .select(`
          *,
          games!inner (
            id,
            merchant_id,
            name
          )
        `)
        .eq("id", parsedInput.skuId)
        .single()) as { data: any; error: any };

      if (skuError || !sku) {
        logPaymentEvent("error", "SKU fetch failed", {
          skuId: parsedInput.skuId,
          error: skuError,
        });
        return {
          success: false,
          message:
            "The requested product is not available. Please try again later.",
        };
      }

      // Validate SKU data
      const priceInCents = sku.prices?.usd;
      const priceValidation = validatePrice(priceInCents);

      if (!priceValidation.valid || !priceInCents) {
        logPaymentEvent("error", "Invalid price validation", {
          skuId: parsedInput.skuId,
          price: priceInCents,
          error: priceValidation.error,
        });
        return {
          success: false,
          message:
            priceValidation.error ||
            "Invalid price configuration for this product.",
        };
      }

      logPaymentEvent("info", "SKU validated", {
        skuId: sku.id,
        gameName: sku.games.name,
        price: `$${(priceInCents / 100).toFixed(2)}`,
      });

      // 2. Pre-create a 'pending' order with enhanced error handling
      const orderData = {
        user_id: user.id,
        sku_id: sku.id,
        merchant_id: sku.games.merchant_id,
        amount: priceInCents,
        currency: "usd", // V1 is USD only as per PRD
        status: "pending" as const,
      };

      const { data: newOrder, error: orderError } = await (
        supabase.from("orders") as any
      )
        .insert(orderData)
        .select("id, created_at")
        .single();

      if (orderError || !newOrder) {
        logPaymentEvent("error", "Order creation failed", {
          orderData,
          error: orderError,
        });
        return {
          success: false,
          message: "Unable to create order. Please try again later.",
        };
      }

      const orderId = newOrder.id;
      logPaymentEvent("info", "Order created successfully", {
        orderId,
        amount: `$${(priceInCents / 100).toFixed(2)}`,
      });

      // 3. Create Stripe Checkout Session with enhanced configuration
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (!appUrl) {
        throw new Error("NEXT_PUBLIC_APP_URL is not configured properly.");
      }

      // Prepare product data with fallbacks
      const productName =
        sku.name[parsedInput.locale] || sku.name.en || "Game Purchase";
      const productDescription =
        sku.description?.[parsedInput.locale] ||
        sku.description?.en ||
        "Digital game content";

      const sessionConfig: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"], // V1 supports cards only
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: productName,
                description: productDescription,
                images: sku.image_url ? [sku.image_url] : [],
                metadata: {
                  sku_id: sku.id,
                  game_id: sku.game_id,
                },
              },
              unit_amount: priceInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${appUrl}/${parsedInput.locale}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/${parsedInput.locale}/games/${sku.game_id}`,
        client_reference_id: orderId, // Critical for webhook idempotency
        customer_email: user.email || undefined,
        metadata: {
          orderId: orderId,
          userId: user.id,
          skuId: sku.id,
          gameId: sku.game_id,
          locale: parsedInput.locale,
        },
        // Enhanced security settings
        billing_address_collection: "auto",
        shipping_address_collection: { allowed_countries: [] }, // No shipping for digital goods
        tax_id_collection: { enabled: false }, // V1 doesn't collect tax IDs
        allow_promotion_codes: false, // V1 doesn't support promo codes
      };

      logPaymentEvent("info", "Creating Stripe session", {
        orderId,
        amount: priceInCents,
        currency: "usd",
      });

      const session = await stripe.checkout.sessions.create(sessionConfig);

      if (!session.url) {
        throw new Error("Stripe session creation failed: No URL returned");
      }

      // Update order with Stripe session ID
      const { error: updateError } = await (supabase.from("orders") as any)
        .update({
          stripe_checkout_session_id: session.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (updateError) {
        logPaymentEvent("warn", "Failed to update order with session ID", {
          orderId,
          sessionId: session.id,
          error: updateError,
        });
        // Don't fail the checkout, but log the issue
      }

      const duration = Date.now() - startTime;
      logPaymentEvent("info", "Checkout session created successfully", {
        orderId,
        sessionId: session.id,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        message: "Checkout session created successfully.",
        checkoutUrl: session.url,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      // Enhanced error logging for debugging
      console.error("=== PAYMENT ERROR DETAILS ===");
      console.error("Error:", error);
      console.error("Error Message:", errorMessage);
      console.error("Error Stack:", error instanceof Error ? error.stack : "No stack trace");
      console.error("SKU ID:", parsedInput.skuId);
      console.error("User ID:", user?.id || "No user");
      console.error("Duration:", `${duration}ms`);
      console.error("Stripe API Version:", "2024-06-20");
      console.error("==============================");

      logPaymentEvent("error", "Checkout session creation failed", {
        skuId: parsedInput.skuId,
        error: errorMessage,
        duration: `${duration}ms`,
        errorDetails: error,
        userId: user?.id,
        stripeApiVersion: "2024-06-20",
      });

      // Attempt to update any created order to 'failed' status
      try {
        // We don't have the orderId here due to the scope, but we could enhance this
        // to track created orders in a better way for cleanup
      } catch (cleanupError) {
        logPaymentEvent("error", "Failed to cleanup after checkout error", {
          cleanupError,
        });
      }

      return {
        success: false,
        message: `Payment processing failed: ${errorMessage}`,
      };
    }
  });
