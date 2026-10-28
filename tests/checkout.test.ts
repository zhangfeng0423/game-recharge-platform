import { beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  user: vi.fn(),
  from: vi.fn(),
  create: vi.fn(),
  expire: vi.fn(),
}));
vi.mock("@/actions/auth.actions", () => ({ getCurrentUser: m.user }));
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseAdminClient: () => ({ from: m.from }),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { create: m.create, expire: m.expire } },
  }),
}));

import { createCheckoutSession } from "@/actions/payment.actions";

const input = {
  skuId: "40000000-0000-4000-8000-000000000001",
  locale: "en" as const,
  playerAccount: "player-001",
  gameServer: "EU-1",
};
function chain(result: { data: unknown; error: unknown }) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.insert.mockReturnValue(q);
  q.update.mockReturnValue(q);
  return q;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("PAYMENTS_ENABLED", "true");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_fixture");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://store.example");
  m.user.mockResolvedValue({ id: "buyer", email: "buyer@example.test" });
});
it("rejects checkout before authentication without touching payment services", async () => {
  m.user.mockResolvedValue(null);
  const result = await createCheckoutSession(input);
  expect(result.data?.success).toBe(false);
  expect(m.create).not.toHaveBeenCalled();
  expect(m.from).not.toHaveBeenCalled();
});
it("requires a signing secret before opening checkout", async () => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
  const result = await createCheckoutSession(input);
  expect(result.data?.success).toBe(false);
  expect(m.from).not.toHaveBeenCalled();
});
it("rejects recipient data that cannot support manual recharge", async () => {
  const result = await createCheckoutSession({ ...input, playerAccount: " " });
  expect(result.validationErrors).toBeDefined();
  expect(m.create).not.toHaveBeenCalled();
});
it("uses the catalogue price and persists recipient/session before returning a URL", async () => {
  const sku = chain({
    data: {
      id: input.skuId,
      game_id: "game",
      name: { en: "Pack" },
      prices: { usd: 1099 },
      games: { id: "game", merchant_id: "owner" },
    },
    error: null,
  });
  const insert = chain({ data: { id: "order1" }, error: null }),
    update = chain({ data: { id: "order1" }, error: null });
  m.from
    .mockReturnValueOnce(sku)
    .mockReturnValueOnce(insert)
    .mockReturnValueOnce(update);
  m.create.mockResolvedValue({
    id: "cs_1",
    url: "https://checkout.stripe.com/test",
  });
  const result = await createCheckoutSession(input);
  expect(result.data?.success).toBe(true);
  expect(insert.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      amount: 1099,
      merchant_id: "owner",
      user_id: "buyer",
      player_account: "player-001",
      game_server: "EU-1",
    }),
  );
  expect(m.create).toHaveBeenCalledWith(
    expect.objectContaining({
      client_reference_id: "order1",
      allowed_payment_method_types: ["card"],
      line_items: [
        expect.objectContaining({
          price_data: expect.objectContaining({
            unit_amount: 1099,
            currency: "usd",
          }),
        }),
      ],
    }),
    { idempotencyKey: "checkout:order1" },
  );
  expect(update.update).toHaveBeenCalledWith({
    stripe_checkout_session_id: "cs_1",
  });
});
it("does not return an unbound payment link after persistence fails", async () => {
  const sku = chain({
    data: {
      id: input.skuId,
      game_id: "game",
      name: { en: "Pack" },
      prices: { usd: 1099 },
      games: { id: "game", merchant_id: "owner" },
    },
    error: null,
  });
  const insert = chain({ data: { id: "order1" }, error: null }),
    update = chain({ data: null, error: { message: "offline" } }),
    cleanup = chain({ data: null, error: null });
  m.from
    .mockReturnValueOnce(sku)
    .mockReturnValueOnce(insert)
    .mockReturnValueOnce(update)
    .mockReturnValueOnce(cleanup);
  m.create.mockResolvedValue({
    id: "cs_1",
    url: "https://checkout.stripe.com/test",
  });
  m.expire.mockResolvedValue({});
  const result = await createCheckoutSession(input);
  expect(result.data?.success).toBe(false);
  expect(result.data?.checkoutUrl).toBeUndefined();
  expect(m.expire).toHaveBeenCalledWith("cs_1");
  expect(cleanup.update).toHaveBeenCalledWith({ status: "failed" });
});
