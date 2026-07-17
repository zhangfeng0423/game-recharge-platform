import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import type { Database } from "@/lib/supabase-types";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

function getStripeConfig() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return null;
  }

  return {
    webhookSecret,
    stripe: new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20" as any,
      typescript: true,
      telemetry: false,
    }),
  };
}

// Webhook event types we handle
const SUPPORTED_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "payment_intent.canceled",
] as const;

// Helper function for logging webhook events
function logWebhookEvent(
  level: "info" | "warn" | "error",
  message: string,
  data?: any,
) {
  const timestamp = new Date().toISOString();
  const _logEntry = {
    timestamp,
    level,
    message,
    data,
  };

  console[level](
    `[WEBHOOK] ${timestamp} - ${message}`,
    data ? JSON.stringify(data, null, 2) : "",
  );
}

// Helper function to safely update order status
async function updateOrderStatus(
  orderId: string,
  status: Database["public"]["Enums"]["orders_status"],
  _metadata?: Record<string, any>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createSupabaseAdminClient();

    const updateData = {
      status,
      updated_at: new Date().toISOString(),
    };

    const { error } = await (supabase.from("orders") as any)
      .update(updateData)
      .eq("id", orderId);

    if (error) {
      logWebhookEvent("error", "Failed to update order status", {
        orderId,
        status,
        error,
      });
      return { success: false, error: error.message };
    }

    logWebhookEvent("info", "Order status updated successfully", {
      orderId,
      status,
    });
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logWebhookEvent("error", "Exception in updateOrderStatus", {
      orderId,
      status,
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  const stripeConfig = getStripeConfig();

  if (!stripeConfig) {
    return new Response("Stripe webhook is not configured", { status: 503 });
  }

  const { stripe, webhookSecret } = stripeConfig;
  const body = await req.text();
  const requestHeaders = await headers();
  const signature = requestHeaders.get("stripe-signature");
  const requestId = crypto.randomUUID();

  logWebhookEvent("info", "Webhook request received", {
    requestId,
    bodyLength: body.length,
  });

  // Security: Validate Stripe signature
  if (!signature) {
    logWebhookEvent("error", "Missing Stripe signature", { requestId });
    return new Response("Missing Stripe signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // At this point, TypeScript knows signature is not null due to the check above
    event = (stripe as any).webhooks.constructEvent(
      body,
      signature,
      webhookSecret,
    );
    logWebhookEvent("info", "Webhook signature verified", {
      requestId,
      eventId: event.id,
      eventType: event.type,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    logWebhookEvent("error", "Webhook signature verification failed", {
      requestId,
      error: errorMessage,
    });
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  // Check if we support this event type
  if (
    !SUPPORTED_EVENT_TYPES.includes(
      event.type as (typeof SUPPORTED_EVENT_TYPES)[number],
    )
  ) {
    logWebhookEvent("info", "Unsupported event type received", {
      requestId,
      eventType: event.type,
      eventId: event.id,
    });
    // Still return 200 to Stripe to acknowledge receipt
    return NextResponse.json({
      received: true,
      requestId,
      message: "Event type not supported",
    });
  }

  try {
    // Handle the event with enhanced processing
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutSessionCompleted(event, requestId);
        break;
      }

      case "checkout.session.expired": {
        await handleCheckoutSessionExpired(event, requestId);
        break;
      }

      case "payment_intent.succeeded": {
        await handlePaymentIntentSucceeded(event, requestId);
        break;
      }

      case "payment_intent.payment_failed": {
        await handlePaymentIntentFailed(event, requestId);
        break;
      }

      case "payment_intent.canceled": {
        await handlePaymentIntentCanceled(event, requestId);
        break;
      }

      default:
        // This should never be reached due to the earlier check
        logWebhookEvent("warn", "Unhandled event type in switch", {
          requestId,
          eventType: event.type,
        });
    }

    const duration = Date.now() - startTime;
    logWebhookEvent("info", "Webhook processed successfully", {
      requestId,
      eventType: event.type,
      eventId: event.id,
      duration: `${duration}ms`,
    });

    return NextResponse.json({
      received: true,
      requestId,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logWebhookEvent("error", "Webhook processing failed", {
      requestId,
      eventType: event.type,
      eventId: event.id,
      error: errorMessage,
      duration: `${duration}ms`,
    });

    // Return 500 for processing errors (Stripe may retry)
    return new Response(`Webhook processing failed: ${errorMessage}`, {
      status: 500,
    });
  }
}

// Enhanced event handler for checkout.session.completed
async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  requestId: string,
) {
  const session = event.data.object as Stripe.Checkout.Session;

  logWebhookEvent("info", "Processing checkout.session.completed", {
    requestId,
    sessionId: session.id,
    clientReferenceId: session.client_reference_id,
    paymentStatus: session.payment_status,
    amountTotal: session.amount_total,
  });

  // Validate required fields
  const orderId = session.client_reference_id;
  if (!orderId) {
    logWebhookEvent(
      "error",
      "Missing client_reference_id in checkout session",
      {
        requestId,
        sessionId: session.id,
      },
    );
    // Don't throw error - return 200 to prevent retries for this issue
    return;
  }

  // Validate payment status
  if (session.payment_status !== "paid") {
    logWebhookEvent("warn", "Checkout session completed but not paid", {
      requestId,
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return;
  }

  const supabase = createSupabaseAdminClient();

  try {
    // Idempotency check: Fetch current order status
    const { data: existingOrder, error: fetchError } = (await supabase
      .from("orders")
      .select("status, amount, currency")
      .eq("id", orderId)
      .single()) as { data: any; error: any };

    if (fetchError) {
      logWebhookEvent("error", "Failed to fetch order for completion", {
        requestId,
        orderId,
        error: fetchError.message,
      });
      throw new Error(`Could not fetch order ${orderId}`);
    }

    if (!existingOrder) {
      logWebhookEvent("error", "Order not found", { requestId, orderId });
      throw new Error(`Order ${orderId} not found`);
    }

    // Idempotency: Skip if already completed
    if (existingOrder.status === "completed") {
      logWebhookEvent(
        "info",
        "Order already completed - idempotent operation",
        {
          requestId,
          orderId,
        },
      );
      return;
    }

    // Validate amounts match for security
    if (session.amount_total && existingOrder.amount !== session.amount_total) {
      logWebhookEvent("error", "Amount mismatch between order and session", {
        requestId,
        orderId,
        orderAmount: existingOrder.amount,
        sessionAmount: session.amount_total,
      });
      throw new Error(`Amount mismatch for order ${orderId}`);
    }

    // Validate currency
    if (session.currency && existingOrder.currency !== session.currency) {
      logWebhookEvent("error", "Currency mismatch between order and session", {
        requestId,
        orderId,
        orderCurrency: existingOrder.currency,
        sessionCurrency: session.currency,
      });
      throw new Error(`Currency mismatch for order ${orderId}`);
    }

    // Update order status to completed
    const { error: updateError } = await updateOrderStatus(
      orderId,
      "completed",
      {
        sessionId: session.id,
        paymentIntentId: session.payment_intent,
        completedAt: new Date().toISOString(),
      },
    );

    if (updateError) {
      throw new Error(`Failed to update order ${orderId}: ${updateError}`);
    }

    logWebhookEvent("info", "Order successfully completed", {
      requestId,
      orderId,
      sessionId: session.id,
      amount: existingOrder.amount,
      currency: existingOrder.currency,
    });
  } catch (error) {
    logWebhookEvent("error", "Exception in handleCheckoutSessionCompleted", {
      requestId,
      orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

// Event handler for checkout.session.expired
async function handleCheckoutSessionExpired(
  event: Stripe.Event,
  requestId: string,
) {
  const session = event.data.object as Stripe.Checkout.Session;

  logWebhookEvent("info", "Processing checkout.session.expired", {
    requestId,
    sessionId: session.id,
    clientReferenceId: session.client_reference_id,
  });

  const orderId = session.client_reference_id;
  if (!orderId) {
    logWebhookEvent("warn", "Missing client_reference_id in expired session", {
      requestId,
      sessionId: session.id,
    });
    return;
  }

  try {
    // Update pending orders to failed when session expires
    const { error: updateError } = await updateOrderStatus(orderId, "failed", {
      expiredSessionId: session.id,
      expiredAt: new Date().toISOString(),
      failureReason: "checkout_session_expired",
    });

    if (updateError) {
      throw new Error(
        `Failed to update expired order ${orderId}: ${updateError}`,
      );
    }

    logWebhookEvent(
      "info",
      "Order marked as failed due to session expiration",
      {
        requestId,
        orderId,
        sessionId: session.id,
      },
    );
  } catch (error) {
    logWebhookEvent("error", "Exception in handleCheckoutSessionExpired", {
      requestId,
      orderId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

// Event handler for payment_intent.succeeded
async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  requestId: string,
) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  logWebhookEvent("info", "Processing payment_intent.succeeded", {
    requestId,
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: paymentIntent.status,
  });

  // Note: This event is supplementary to checkout.session.completed
  // The main order processing happens in checkout.session.completed
  logWebhookEvent(
    "info",
    "Payment intent succeeded - order completion handled by checkout.session.completed",
    {
      requestId,
      paymentIntentId: paymentIntent.id,
    },
  );
}

// Event handler for payment_intent.payment_failed
async function handlePaymentIntentFailed(
  event: Stripe.Event,
  requestId: string,
) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  logWebhookEvent("info", "Processing payment_intent.payment_failed", {
    requestId,
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    lastPaymentError: paymentIntent.last_payment_error,
  });

  // Try to find associated order through metadata or other means
  // This is a placeholder for future enhancement
  logWebhookEvent(
    "info",
    "Payment intent failed - order may be updated by checkout events",
    {
      requestId,
      paymentIntentId: paymentIntent.id,
    },
  );
}

// Event handler for payment_intent.canceled
async function handlePaymentIntentCanceled(
  event: Stripe.Event,
  requestId: string,
) {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;

  logWebhookEvent("info", "Processing payment_intent.canceled", {
    requestId,
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  });

  // Try to find associated order and update status if needed
  // This is a placeholder for future enhancement
  logWebhookEvent(
    "info",
    "Payment intent canceled - order may be updated by checkout events",
    {
      requestId,
      paymentIntentId: paymentIntent.id,
    },
  );
}
