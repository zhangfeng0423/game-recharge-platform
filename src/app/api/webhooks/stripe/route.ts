import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !process.env.STRIPE_SECRET_KEY)
    return NextResponse.json(
      { error: "Webhook is not configured" },
      { status: 503 },
    );
  const signature = request.headers.get("stripe-signature");
  if (!signature)
    return NextResponse.json({ error: "Signature required" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
    ].includes(event.type)
  )
    return NextResponse.json({ received: true });
  const session = event.data.object as Stripe.Checkout.Session;
  if (!session.client_reference_id)
    return NextResponse.json({ received: true });
  const expired = event.type === "checkout.session.expired";
  if (!expired && session.payment_status !== "paid")
    return NextResponse.json({ received: true });
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db.rpc("apply_checkout_event", {
      p_event_id: event.id,
      p_order_id: session.client_reference_id,
      p_session_id: session.id,
      p_status: expired ? "failed" : "completed",
      p_amount: session.amount_total ?? -1,
      p_currency: session.currency ?? "",
    });
    if (error) throw error;
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json(
      { error: "Unable to persist payment event" },
      { status: 500 },
    );
  }
}
