import Stripe from "stripe";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseAdminClient: () => ({ rpc: mock.rpc }),
}));

import { POST } from "@/app/api/webhooks/stripe/route";

const stripe = new Stripe("sk_test_fixture");
const secret = "whsec_local_fixture_only";
function request(
  type = "checkout.session.completed",
  patch: Record<string, unknown> = {},
) {
  const payload = JSON.stringify({
    id: "evt_fixture",
    type,
    data: {
      object: {
        id: "cs_fixture",
        client_reference_id: "00000000-0000-0000-0000-000000000001",
        amount_total: 100,
        currency: "usd",
        payment_status: "paid",
        ...patch,
      },
    },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": signature },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fixture");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
  mock.rpc.mockResolvedValue({ error: null });
});
it("returns a retryable configuration error when the secret is missing", async () => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  expect((await POST(request())).status).toBe(503);
});
it("rejects unsigned requests without touching the database", async () => {
  expect(
    (
      await POST(
        new Request("http://localhost", { method: "POST", body: "{}" }),
      )
    ).status,
  ).toBe(400);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects tampered signed requests", async () => {
  const req = request();
  expect(
    (
      await POST(
        new Request(req.url, {
          method: "POST",
          body: "{}",
          headers: req.headers,
        }),
      )
    ).status,
  ).toBe(400);
});
it("persists only verified paid sessions through the transaction", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith(
    "apply_checkout_event",
    expect.objectContaining({
      p_session_id: "cs_fixture",
      p_amount: 100,
      p_status: "completed",
      p_event_id: "evt_fixture",
    }),
  );
});
it("does not mark an unpaid completed session as paid", async () => {
  expect(
    (
      await POST(
        request("checkout.session.completed", { payment_status: "unpaid" }),
      )
    ).status,
  ).toBe(200);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("returns 500 when persistence fails so Stripe can retry", async () => {
  mock.rpc.mockResolvedValue({ error: { message: "offline" } });
  expect((await POST(request())).status).toBe(500);
});
it("ignores unrelated event types", async () => {
  expect((await POST(request("payment_intent.succeeded"))).status).toBe(200);
  expect(mock.rpc).not.toHaveBeenCalled();
});
