import Stripe from "stripe";
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Payment service is not configured");
  if (
    !key.startsWith("sk_test_") &&
    process.env.ALLOW_LIVE_PAYMENTS !== "true"
  ) {
    throw new Error("Live payments have not been enabled");
  }
  return new Stripe(key, { typescript: true, telemetry: false });
}
